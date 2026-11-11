-- "nights" is retained as an internal storage name. One visible item is now
-- one tournament, with its own rules, start time, registrations and competition.
alter table public.nights add column rules text not null default '' check(length(rules)<=5000);
alter table public.nights add column grace_minutes integer not null default 0 check(grace_minutes>=0);
alter table public.registrations add column excluded boolean not null default false;
alter table public.registrations add column rules_accepted boolean not null default false;
alter table public.profiles add column is_banned boolean not null default false;
alter table public.profiles add column ban_reason text not null default '' check(length(ban_reason)<=500);
create table public.registration_notices (
 registration_id uuid primary key references public.registrations(id) on delete cascade,
 excluded boolean not null,
 reason text not null check(length(reason) between 1 and 500),
 changed_by uuid not null references public.profiles(id),
 changed_at timestamptz not null default now()
);
alter table public.registration_notices enable row level security;
revoke all on public.registration_notices from public,anon,authenticated;
grant select on public.registration_notices to authenticated;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not is_banned);
$$;
create function public.is_active_member() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and not is_banned);
$$;
revoke execute on function public.is_active_member() from public,anon,authenticated;
grant execute on function public.is_active_member() to authenticated;
alter policy club_read on public.clubs using((select public.is_active_member()));
alter policy night_read on public.nights using((select public.is_active_member()));
alter policy registration_read on public.registrations using((select public.is_active_member()));
alter policy contact_read on public.club_contacts using((select public.is_active_member()) and ((select public.is_admin()) or exists(select 1 from public.clubs c where c.id=club_id and c.owner_id=auth.uid())));
create policy notice_read on public.registration_notices for select to authenticated using((select public.is_active_member()) and ((select public.is_admin()) or exists(select 1 from public.registrations r join public.clubs c on c.id=r.club_id where r.id=registration_id and c.owner_id=auth.uid())));

create function public.list_tournaments() returns table(id uuid,name text,play_date date,start_time time,status text,tournaments jsonb,rules text,grace_minutes integer,effective_start timestamptz)
language sql stable security invoker set search_path = '' as $$
 select n.id,n.name,n.play_date,n.start_time,n.status,n.tournaments,n.rules,n.grace_minutes,
 ((n.play_date+n.start_time) at time zone 'Europe/Madrid')+make_interval(mins=>n.grace_minutes)
 from public.nights n order by n.created_at;
$$;
revoke execute on function public.list_tournaments() from public,anon,authenticated;
grant execute on function public.list_tournaments() to authenticated;

-- Intentional public, read-only projection for a single shared UUID. Never
-- expose contacts, captain identities, other tournaments or private notices.
create function public.get_public_tournament(p_tournament_id uuid) returns table(id uuid,name text,play_date date,start_time time,rules text,status text,grace_minutes integer,effective_start timestamptz,registered_count bigint)
language sql stable security definer set search_path = '' as $$
 select n.id,n.name,n.play_date,n.start_time,n.rules,n.status,n.grace_minutes,
 ((n.play_date+n.start_time) at time zone 'Europe/Madrid')+make_interval(mins=>n.grace_minutes),
 (select count(*) from public.registrations r where r.night_id=n.id)
 from public.nights n where n.id=p_tournament_id;
$$;
revoke execute on function public.get_public_tournament(uuid) from public,anon,authenticated;
grant execute on function public.get_public_tournament(uuid) to anon,authenticated;

create function public.create_tournament(p_name text,p_date date,p_time time,p_rules text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tournament uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden crear torneos.'; end if;
 if p_rules is null or length(btrim(p_rules))=0 or length(p_rules)>5000 then raise exception 'Escribe las normas del torneo (máximo 5000 caracteres).'; end if;
 insert into public.nights(name,play_date,start_time,rules) values(btrim(p_name),p_date,p_time,btrim(p_rules)) returning id into tournament;
 return tournament;
end; $$;
create function public.extend_tournament_start(p_tournament_id uuid,p_minutes integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden ampliar el margen.'; end if;
 if p_minutes is null or p_minutes<1 or p_minutes>120 then raise exception 'El margen debe estar entre 1 y 120 minutos.'; end if;
 update public.nights set grace_minutes=grace_minutes+p_minutes where id=p_tournament_id and status='open';
 if not found then raise exception 'El torneo no existe o ya está cerrado.'; end if;
end; $$;

create or replace function public.register_club(p_night_id uuid,p_club_id uuid) returns public.registrations language plpgsql security definer set search_path = '' as $$
declare n public.nights; registration public.registrations; owner uuid; banned boolean;
begin
 if not public.is_active_member() then raise exception 'Tu cuenta no puede inscribirse.'; end if;
 select owner_id into owner from public.clubs where id=p_club_id;
 if not found then raise exception 'Club no encontrado.'; end if;
 if not public.is_admin() and owner is distinct from auth.uid() then raise exception 'Solo puedes inscribir tu propio club.'; end if;
 if owner is not null then
  select is_banned into banned from public.profiles where id=owner for key share;
  if banned then raise exception 'El capitán de este club tiene la cuenta suspendida.'; end if;
 end if;
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status<>'open' then raise exception 'Las inscripciones están cerradas.'; end if;
 if exists(select 1 from public.registrations where night_id=p_night_id and club_id=p_club_id) then raise exception 'El club ya está inscrito.'; end if;
 insert into public.registrations(night_id,club_id,registration_number,registered_by) values(p_night_id,p_club_id,n.next_registration_number,auth.uid()) returning * into registration;
 update public.nights set next_registration_number=next_registration_number+1 where id=p_night_id;
 return registration;
end; $$;

-- The old primitive remains internal to administrator RPCs and the new join.
-- Captains must use join_tournament so rule acceptance cannot be bypassed.
revoke execute on function public.register_club(uuid,uuid) from public,anon,authenticated;
create function public.join_tournament(p_tournament_id uuid,p_accept_rules boolean) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare n public.nights; club uuid; registration public.registrations;
begin
 perform 1 from public.profiles where id=auth.uid() and not is_banned for key share;
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
create function public.set_registration_excluded(p_tournament_id uuid,p_club_id uuid,p_excluded boolean,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.nights; registration uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden decidir los participantes.'; end if;
 if p_excluded is null or p_reason is null or length(btrim(p_reason))=0 or length(p_reason)>500 then raise exception 'Indica un motivo de hasta 500 caracteres.'; end if;
 select * into n from public.nights where id=p_tournament_id for update;
 if not found or n.status<>'open' then raise exception 'El torneo ya está cerrado.'; end if;
 if not p_excluded and exists(select 1 from public.clubs c join public.profiles p on p.id=c.owner_id where c.id=p_club_id and p.is_banned) then raise exception 'El capitán de este club tiene la cuenta suspendida.'; end if;
 update public.registrations set excluded=p_excluded where night_id=p_tournament_id and club_id=p_club_id returning id into registration;
 if not found then raise exception 'Inscripción no encontrada.'; end if;
 insert into public.registration_notices(registration_id,excluded,reason,changed_by) values(registration,p_excluded,btrim(p_reason),auth.uid())
 on conflict(registration_id) do update set excluded=excluded.excluded,reason=excluded.reason,changed_by=excluded.changed_by,changed_at=now();
end; $$;

create or replace function public.confirm_plan(p_night_id uuid,p_plan jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.nights; total integer; distinct_total integer; registered integer; normalized_plan jsonb;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden decidir el formato e iniciar el torneo.'; end if;
 perform public.check_competition_plan(p_plan);
 if jsonb_array_length(p_plan)<>1 then raise exception 'Configura una única Copa o Liga con los participantes elegidos para este torneo.'; end if;
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status<>'open' then raise exception 'El torneo ya está cerrado.'; end if;
 if now()<((n.play_date+n.start_time) at time zone 'Europe/Madrid')+make_interval(mins=>n.grace_minutes) then raise exception 'Todavía no ha llegado la hora de inicio indicada.'; end if;
 select count(*),count(distinct id) into total,distinct_total from jsonb_array_elements(p_plan) t cross join lateral jsonb_array_elements_text(t->'clubIds') ids(id);
 select count(*) into registered from public.registrations where night_id=p_night_id and not excluded;
 if total<>registered or distinct_total<>registered or exists(select 1 from jsonb_array_elements(p_plan) t cross join lateral jsonb_array_elements_text(t->'clubIds') ids(id) where not exists(select 1 from public.registrations r where r.night_id=p_night_id and r.club_id::text=ids.id and not r.excluded)) then raise exception 'El formato debe incluir exactamente a los clubes que siguen dentro del torneo.'; end if;
 select jsonb_agg(t||jsonb_build_object('format',coalesce(t->>'format',case when (t->>'size')::integer=6 then 'liga' else 'copa' end)) order by ordinal) into normalized_plan from jsonb_array_elements(p_plan) with ordinality entries(t,ordinal);
 update public.nights set tournaments=normalized_plan,status='closed' where id=p_night_id;
end; $$;

create or replace function public.create_my_club(p_name text,p_contacts text[] default '{}') returns uuid language plpgsql security definer set search_path = '' as $$
declare club uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and not is_banned for key share;
 if not found then raise exception 'Tu cuenta no puede crear clubes.'; end if;
 perform public.check_contacts(p_contacts);
 insert into public.clubs(name,owner_id) values(btrim(p_name),auth.uid()) returning id into club;
 insert into public.club_contacts(club_id,phones) values(club,p_contacts);
 return club;
end; $$;
create or replace function public.update_my_contacts(p_contacts text[]) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.profiles where id=auth.uid() and not is_banned for key share;
 if not found then raise exception 'Tu cuenta no puede modificar contactos.'; end if;
 perform public.check_contacts(p_contacts);
 update public.club_contacts set phones=p_contacts where club_id in(select id from public.clubs where owner_id=auth.uid());
 if not found then raise exception 'No tienes un club vinculado.'; end if;
end; $$;
create function public.set_member_ban(p_member_id uuid,p_banned boolean,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare member public.profiles; tournament uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden moderar cuentas.'; end if;
 if p_banned is null or p_reason is null or length(btrim(p_reason))=0 or length(p_reason)>500 then raise exception 'Indica el motivo de la decisión (máximo 500 caracteres).'; end if;
 select * into member from public.profiles where id=p_member_id for update;
 if not found or member.role='admin' or member.id=auth.uid() then raise exception 'No se puede suspender esta cuenta desde aquí.'; end if;
 -- Lock affected tournaments in stable order, using the same lock as joins and closure.
 for tournament in select n.id from public.nights n where n.status='open' and exists(select 1 from public.registrations r join public.clubs c on c.id=r.club_id where r.night_id=n.id and c.owner_id=p_member_id) order by n.id for update loop
  if p_banned then
   update public.registrations r set excluded=true where r.night_id=tournament and r.club_id in(select id from public.clubs where owner_id=p_member_id);
   insert into public.registration_notices(registration_id,excluded,reason,changed_by)
   select r.id,true,'Club fuera del torneo por una decisión de moderación.',auth.uid() from public.registrations r join public.clubs c on c.id=r.club_id where r.night_id=tournament and c.owner_id=p_member_id
   on conflict(registration_id) do update set excluded=true,reason=excluded.reason,changed_by=excluded.changed_by,changed_at=now();
  end if;
 end loop;
 update public.profiles set is_banned=p_banned,ban_reason=case when p_banned then btrim(p_reason) else '' end where id=p_member_id;
end; $$;
revoke execute on function public.create_tournament(text,date,time,text),public.extend_tournament_start(uuid,integer),public.join_tournament(uuid,boolean),public.set_registration_excluded(uuid,uuid,boolean,text),public.set_member_ban(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.create_tournament(text,date,time,text),public.extend_tournament_start(uuid,integer),public.join_tournament(uuid,boolean),public.set_registration_excluded(uuid,uuid,boolean,text),public.set_member_ban(uuid,boolean,text) to authenticated;

-- Retire the old unruled creation / destructive removal endpoints. Names in
-- storage remain compatible; clients now use the explicit tournament RPCs.
revoke execute on function public.create_night(text,date,time),public.remove_registration(uuid,uuid) from public,anon,authenticated;
create or replace function public.assign_club_captain(p_club_id uuid,p_ea_id text) returns void language plpgsql security definer set search_path = '' as $$
declare captain uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden vincular un capitán.'; end if;
 select id into captain from public.profiles where ea_key=public.normalized_key(p_ea_id) and not is_banned;
 if captain is null then raise exception 'El capitán debe tener una cuenta activa.'; end if;
 update public.clubs set owner_id=captain where id=p_club_id and owner_id is null;
 if not found then raise exception 'El club ya tiene capitán o no existe.'; end if;
end; $$;
