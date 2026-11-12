alter table public.clubs add column badge_path text;
alter table public.clubs add column club_version integer not null default 0;
alter table public.profiles add column club_operation_token uuid;
alter table public.profiles add column club_operation_until timestamptz;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('club-badges','club-badges',false,2097152,array['image/png','image/jpeg']);
-- Service uploads only. Active members may sign URLs only for current badges.
create policy club_badge_read on storage.objects for select to authenticated using(
 bucket_id='club-badges' and (select public.is_active_member()) and exists(select 1 from public.clubs c where c.badge_path=storage.objects.name and c.deleted_at is null)
);
create index club_badge_path on public.clubs(badge_path) where badge_path is not null;
create function public.begin_club_operation(p_member_id uuid,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member public.profiles; token uuid:=gen_random_uuid();
begin
 select * into member from public.profiles where id=p_member_id for update;
 if not found or member.deletion_pending or (member.is_banned and p_delete is distinct from true) then raise exception 'Tu cuenta no puede modificar el club.'; end if;
 if member.club_operation_until>now() then raise exception 'Hay otra operación de tu club en curso. Espera un momento e inténtalo de nuevo.'; end if;
 update public.profiles set club_operation_token=token,club_operation_until=now()+interval '10 minutes' where id=p_member_id;
 return token;
end; $$;
create function public.end_club_operation(p_member_id uuid,p_token uuid) returns void language sql security definer set search_path = '' as $$
 update public.profiles set club_operation_token=null,club_operation_until=null where id=p_member_id and club_operation_token=p_token;
$$;
create function public.save_club_profile(p_member_id uuid,p_token uuid,p_name text,p_contacts text[],p_badge_path text,p_version integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member public.profiles; club public.clubs;
begin
 select * into member from public.profiles where id=p_member_id for update;
 if not found or member.is_banned or member.deletion_pending or p_token is null or member.club_operation_token is distinct from p_token or member.club_operation_until is null or member.club_operation_until<=now() then raise exception 'Tu cuenta no puede modificar el club.'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 50 then raise exception 'Escribe un nombre de club de hasta 50 caracteres.'; end if;
 perform public.check_contacts(p_contacts);
 if p_badge_path is not null and (p_badge_path !~ ('^'||p_member_id::text||'/[0-9a-f-]{36}\.(png|jpg)$') or not exists(select 1 from storage.objects where bucket_id='club-badges' and name=p_badge_path)) then raise exception 'No se pudo verificar el escudo de este club.'; end if;
 select * into club from public.clubs where owner_id=p_member_id and deleted_at is null for update;
 if p_version is null then
  if found then raise exception 'Ya tienes un club. Actualiza la información antes de editarlo.'; end if;
  insert into public.clubs(name,owner_id,badge_path) values(btrim(p_name),p_member_id,p_badge_path) returning * into club;
  insert into public.club_contacts(club_id,phones) values(club.id,p_contacts);
 else
  if not found or club.club_version<>p_version then raise exception 'El club ha cambiado. Actualiza antes de guardarlo otra vez.'; end if;
  update public.clubs set name=btrim(p_name),badge_path=p_badge_path,club_version=club_version+1 where id=club.id;
  update public.club_contacts set phones=p_contacts where club_id=club.id;
 end if;
 return club.id;
end; $$;
create function public.delete_club_profile(p_member_id uuid,p_token uuid,p_confirmation text) returns void
language plpgsql security definer set search_path = '' as $$
declare member public.profiles; club public.clubs;
begin
 select * into member from public.profiles where id=p_member_id for update;
 if not found or member.deletion_pending or p_token is null or member.club_operation_token is distinct from p_token or member.club_operation_until is null or member.club_operation_until<=now() then raise exception 'No se pudo verificar la eliminación del club.'; end if;
 select * into club from public.clubs where owner_id=p_member_id and deleted_at is null;
 if not found or p_confirmation is distinct from club.name then raise exception 'Escribe el nombre exacto de tu club para confirmar.'; end if;
 perform public.erase_owned_club(p_member_id);
end; $$;
revoke execute on function public.begin_club_operation(uuid,boolean),public.end_club_operation(uuid,uuid),public.save_club_profile(uuid,uuid,text,text[],text,integer),public.delete_club_profile(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_club_operation(uuid,boolean),public.end_club_operation(uuid,uuid),public.save_club_profile(uuid,uuid,text,text[],text,integer),public.delete_club_profile(uuid,uuid,text) to service_role;
-- Retire direct client deletion: the Edge function purges files first.
revoke execute on function public.delete_my_club(text) from public,anon,authenticated;

create or replace function public.erase_owned_club(p_owner_id uuid) returns void language plpgsql set search_path = '' as $$
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
  update public.clubs set name='Club eliminado · '||replace(club::text,'-',''),owner_id=null,badge_path=null,deleted_at=now() where id=club;
 else
  delete from public.clubs where id=club;
 end if;
end; $$;

create or replace function public.prepare_account_deletion(p_member_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.profiles where id=p_member_id for update;
 if not found then raise exception 'Perfil no disponible.'; end if;
 if exists(select 1 from public.profiles where id=p_member_id and club_operation_until>now()) then raise exception 'Hay otra operación de tu club en curso. Espera un momento e inténtalo de nuevo.'; end if;
 perform public.erase_owned_club(p_member_id);
 update public.profiles set deletion_pending=true where id=p_member_id;
end; $$;

create or replace function public.update_my_contacts(p_contacts text[]) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.profiles where id=auth.uid() and not is_banned and not deletion_pending for key share;
 if not found then raise exception 'Tu cuenta no puede modificar contactos.'; end if;
 perform public.check_contacts(p_contacts);
 update public.club_contacts set phones=p_contacts where club_id in(select id from public.clubs where owner_id=auth.uid());
 if not found then raise exception 'No tienes un club vinculado.'; end if;
 update public.clubs set club_version=club_version+1 where owner_id=auth.uid() and deleted_at is null;
end; $$;
