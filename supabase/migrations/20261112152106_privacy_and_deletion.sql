-- Profile removal must not cascade through sporting history.
alter table public.profiles add column deletion_pending boolean not null default false;
alter table public.clubs add column deleted_at timestamptz;
alter table public.clubs drop constraint clubs_owner_id_fkey;
alter table public.clubs add constraint clubs_owner_id_fkey foreign key(owner_id) references public.profiles(id) on delete set null;
alter table public.registrations alter column registered_by drop not null;
alter table public.registrations drop constraint registrations_registered_by_fkey;
alter table public.registrations add constraint registrations_registered_by_fkey foreign key(registered_by) references public.profiles(id) on delete set null;
alter table public.registration_notices alter column changed_by drop not null;
alter table public.registration_notices drop constraint registration_notices_changed_by_fkey;
alter table public.registration_notices add constraint registration_notices_changed_by_fkey foreign key(changed_by) references public.profiles(id) on delete set null;
alter table public.competition_matches drop constraint competition_matches_updated_by_fkey;
alter table public.competition_matches add constraint competition_matches_updated_by_fkey foreign key(updated_by) references public.profiles(id) on delete set null;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not is_banned and not deletion_pending);
$$;
create or replace function public.is_active_member() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and not is_banned and not deletion_pending);
$$;

-- Internal only. Lock the profile, then events in stable order, then the club.
-- This matches the registration/moderation lock order and retains score FKs.
create function public.erase_owned_club(p_owner_id uuid) returns void language plpgsql set search_path = '' as $$
declare club uuid; tournament uuid;
begin
 perform 1 from public.profiles where id=p_owner_id for update;
 select id into club from public.clubs where owner_id=p_owner_id and deleted_at is null;
 if club is null then return; end if;
 for tournament in select n.id from public.nights n where exists(select 1 from public.registrations r where r.night_id=n.id and r.club_id=club) order by n.id for update loop null; end loop;
 perform 1 from public.clubs where id=club for update;
 delete from public.club_contacts where club_id=club;
 delete from public.registration_notices where registration_id in(select id from public.registrations where club_id=club);
 delete from public.registrations r using public.nights n where r.night_id=n.id and r.club_id=club and n.status='open';
 update public.registrations set registered_by=null where club_id=club;
 if exists(select 1 from public.registrations where club_id=club) or exists(select 1 from public.competition_matches where home_id=club or away_id=club) then
  update public.clubs set name='Club eliminado · '||replace(club::text,'-',''),owner_id=null,deleted_at=now() where id=club;
 else
  delete from public.clubs where id=club;
 end if;
end; $$;
revoke execute on function public.erase_owned_club(uuid) from public,anon,authenticated;

create function public.delete_my_club(p_confirmation text) returns void language plpgsql security definer set search_path = '' as $$
declare club public.clubs;
begin
 perform 1 from public.profiles where id=auth.uid() and not deletion_pending for update;
 if not found then raise exception 'Inicia sesión con tu cuenta para eliminar tu club.'; end if;
 select * into club from public.clubs where owner_id=auth.uid() and deleted_at is null;
 if not found then raise exception 'No tienes un club vinculado.'; end if;
 if p_confirmation is distinct from club.name then raise exception 'Escribe el nombre exacto de tu club para confirmar.'; end if;
 perform public.erase_owned_club(auth.uid());
end; $$;
revoke execute on function public.delete_my_club(text) from public,anon,authenticated;
grant execute on function public.delete_my_club(text) to authenticated;

-- Service-only preparation follows password reauthentication in account-delete.
-- Pending blocks even old JWTs while Auth revocation/deletion is retried.
create function public.prepare_account_deletion(p_member_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.profiles where id=p_member_id for update;
 if not found then raise exception 'Perfil no disponible.'; end if;
 perform public.erase_owned_club(p_member_id);
 update public.profiles set deletion_pending=true where id=p_member_id;
end; $$;
revoke execute on function public.prepare_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

-- Keep direct profile locks consistent with the pending-deletion guard.
create or replace function public.create_my_club(p_name text,p_contacts text[] default '{}') returns uuid language plpgsql security definer set search_path = '' as $$
declare club uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and not is_banned and not deletion_pending for key share;
 if not found then raise exception 'Tu cuenta no puede crear clubes.'; end if;
 perform public.check_contacts(p_contacts);
 insert into public.clubs(name,owner_id) values(btrim(p_name),auth.uid()) returning id into club;
 insert into public.club_contacts(club_id,phones) values(club,p_contacts);
 return club;
end; $$;
create or replace function public.update_my_contacts(p_contacts text[]) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.profiles where id=auth.uid() and not is_banned and not deletion_pending for key share;
 if not found then raise exception 'Tu cuenta no puede modificar contactos.'; end if;
 perform public.check_contacts(p_contacts);
 update public.club_contacts set phones=p_contacts where club_id in(select id from public.clubs where owner_id=auth.uid());
 if not found then raise exception 'No tienes un club vinculado.'; end if;
end; $$;
create or replace function public.join_tournament(p_tournament_id uuid,p_accept_rules boolean) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare n public.nights; club uuid; registration public.registrations;
begin
 perform 1 from public.profiles where id=auth.uid() and not is_banned and not deletion_pending for key share;
 if not found then raise exception 'Tu cuenta no puede inscribirse.'; end if;
 select id into club from public.clubs where owner_id=auth.uid();
 if club is null then raise exception 'Crea tu club o solicita al administrador que lo vincule a tu cuenta.'; end if;
 select * into n from public.nights where id=p_tournament_id for update;
 if not found or n.status<>'open' then raise exception 'Las inscripciones están cerradas.'; end if;
 if length(n.rules)>0 and p_accept_rules is distinct from true then raise exception 'Debes aceptar las normas del torneo.'; end if;
 select * into registration from public.registrations where night_id=p_tournament_id and club_id=club;
 if found then
  if registration.excluded then raise exception 'Tu club está fuera de este torneo. Consulta el aviso de la organización.'; end if;
  return registration;
 end if;
 registration := public.register_club(p_tournament_id,club);
 update public.registrations set rules_accepted=coalesce(p_accept_rules,false) where id=registration.id returning * into registration;
 return registration;
end; $$;
create or replace function public.register_club(p_night_id uuid,p_club_id uuid) returns public.registrations language plpgsql security definer set search_path = '' as $$
declare n public.nights; registration public.registrations; owner uuid; banned boolean;
begin
 if not public.is_active_member() then raise exception 'Tu cuenta no puede inscribirse.'; end if;
 select owner_id into owner from public.clubs where id=p_club_id and deleted_at is null;
 if not found then raise exception 'Club no encontrado.'; end if;
 if not public.is_admin() and owner is distinct from auth.uid() then raise exception 'Solo puedes inscribir tu propio club.'; end if;
 if owner is not null then
  select (is_banned or deletion_pending) into banned from public.profiles where id=owner for key share;
  if not found or banned then raise exception 'El capitán de este club tiene la cuenta suspendida.'; end if;
 end if;
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status<>'open' then raise exception 'Las inscripciones están cerradas.'; end if;
 if exists(select 1 from public.registrations where night_id=p_night_id and club_id=p_club_id) then raise exception 'El club ya está inscrito.'; end if;
 insert into public.registrations(night_id,club_id,registration_number,registered_by) values(p_night_id,p_club_id,n.next_registration_number,auth.uid()) returning * into registration;
 update public.nights set next_registration_number=next_registration_number+1 where id=p_night_id;
 return registration;
end; $$;
create or replace function public.assign_club_captain(p_club_id uuid,p_ea_id text) returns void language plpgsql security definer set search_path = '' as $$
declare captain uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden vincular un capitán.'; end if;
 select id into captain from public.profiles where ea_key=public.normalized_key(p_ea_id) and not is_banned and not deletion_pending;
 if captain is null then raise exception 'El capitán debe tener una cuenta activa.'; end if;
 update public.clubs set owner_id=captain where id=p_club_id and owner_id is null and deleted_at is null;
 if not found then raise exception 'El club ya tiene capitán o no existe.'; end if;
end; $$;
