-- Independent MCM project. Never apply this migration to ConvoSquad.
create function public.normalized_key(value text) returns text language sql immutable strict
set search_path = '' as $$ select lower(regexp_replace(btrim(value), '\s+', ' ', 'g')); $$;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 ea_id text not null check (char_length(btrim(ea_id)) between 3 and 40 and ea_id !~ '[[:cntrl:]]'),
 ea_key text generated always as (public.normalized_key(ea_id)) stored unique,
 role text not null default 'captain' check (role in ('captain','admin')),
 created_at timestamptz not null default now()
);
create table public.clubs (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 50),
 name_key text generated always as (public.normalized_key(name)) stored unique,
 owner_id uuid unique references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.club_contacts (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 phones text[] not null default '{}',
 constraint maximum_three_contacts check (cardinality(phones) <= 3)
);
create table public.nights (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 70),
 play_date date not null,
 start_time time not null,
 status text not null default 'open' check (status in ('open','closed')),
 next_registration_number bigint not null default 1,
 tournaments jsonb not null default '[]' check (jsonb_typeof(tournaments) = 'array'),
 created_at timestamptz not null default now()
);
create table public.registrations (
 id uuid primary key default gen_random_uuid(),
 night_id uuid not null references public.nights(id),
 club_id uuid not null references public.clubs(id),
 registration_number bigint not null check (registration_number > 0),
 registered_at timestamptz not null default clock_timestamp(),
 registered_by uuid not null references public.profiles(id),
 unique(night_id,club_id), unique(night_id,registration_number)
);
create index registration_arrival on public.registrations(night_id,registration_number);

create function public.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from public.profiles where id = auth.uid() and role='admin'); $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,ea_id) values (new.id,btrim(new.raw_user_meta_data->>'ea_id'));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_contacts enable row level security;
alter table public.nights enable row level security;
alter table public.registrations enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy club_read on public.clubs for select to authenticated using(true);
create policy contact_read on public.club_contacts for select to authenticated using(public.is_admin() or exists(select 1 from public.clubs c where c.id=club_id and c.owner_id=auth.uid()));
create policy night_read on public.nights for select to authenticated using(true);
create policy registration_read on public.registrations for select to authenticated using(true);
-- Writes go through the checked RPCs below. No client can grant itself a role.
revoke all on public.profiles,public.clubs,public.club_contacts,public.nights,public.registrations from anon,authenticated;
grant select on public.profiles,public.clubs,public.club_contacts,public.nights,public.registrations to authenticated;

create function public.check_contacts(phones text[]) returns void language plpgsql set search_path = '' as $$
begin
 if phones is null or cardinality(phones)>3 or exists(select 1 from unnest(phones) p where p is null or length(p)>24 or length(btrim(p))=0) then
  raise exception 'Hasta tres teléfonos válidos, de un máximo de 24 caracteres.';
 end if;
end; $$;
create function public.create_my_club(p_name text,p_contacts text[] default '{}') returns uuid language plpgsql security definer set search_path = '' as $$
declare club uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
 perform public.check_contacts(p_contacts);
 insert into public.clubs(name,owner_id) values(btrim(p_name),auth.uid()) returning id into club;
 insert into public.club_contacts(club_id,phones) values(club,p_contacts);
 return club;
end; $$;
create function public.update_my_contacts(p_contacts text[]) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
 perform public.check_contacts(p_contacts);
 update public.club_contacts set phones=p_contacts where club_id in (select id from public.clubs where owner_id=auth.uid());
 if not found then raise exception 'No tienes un club vinculado.'; end if;
end; $$;
create function public.create_night(p_name text,p_date date,p_time time) returns uuid language plpgsql security definer set search_path = '' as $$
declare n uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden crear torneos.'; end if;
 insert into public.nights(name,play_date,start_time) values(btrim(p_name),p_date,p_time) returning id into n;
 return n;
end; $$;
create function public.register_club(p_night_id uuid,p_club_id uuid) returns public.registrations language plpgsql security definer set search_path = '' as $$
declare n public.nights; registration public.registrations;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
 if not public.is_admin() and not exists(select 1 from public.clubs where id=p_club_id and owner_id=auth.uid()) then raise exception 'Solo puedes inscribir tu propio club.'; end if;
 -- One lock serializes all registrations and closure for a night. The server,
 -- never the phone clock, assigns the definitive arrival number.
 select * into n from public.nights where id=p_night_id for update;
 if not found then raise exception 'Noche no encontrada.'; end if;
 if n.status <> 'open' then raise exception 'Las inscripciones están cerradas.'; end if;
 if exists(select 1 from public.registrations where night_id=p_night_id and club_id=p_club_id) then raise exception 'El club ya está inscrito.'; end if;
 insert into public.registrations(night_id,club_id,registration_number,registered_by) values(p_night_id,p_club_id,n.next_registration_number,auth.uid()) returning * into registration;
 update public.nights set next_registration_number=next_registration_number+1 where id=p_night_id;
 return registration;
end; $$;
create function public.admin_register_club(p_night_id uuid,p_name text,p_contacts text[] default '{}') returns public.registrations language plpgsql security definer set search_path = '' as $$
declare club uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden añadir clubes manualmente.'; end if;
 perform public.check_contacts(p_contacts);
 select id into club from public.clubs where name_key=public.normalized_key(p_name);
 if club is null then
  insert into public.clubs(name) values(btrim(p_name)) returning id into club;
  insert into public.club_contacts(club_id,phones) values(club,p_contacts);
 end if;
 return public.register_club(p_night_id,club);
end; $$;
create function public.remove_registration(p_night_id uuid,p_club_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare n public.nights;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden retirar inscripciones.'; end if;
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status <> 'open' then raise exception 'La inscripción está cerrada.'; end if;
 delete from public.registrations where night_id=p_night_id and club_id=p_club_id;
 -- Never decrement the counter or renumber remaining clubs.
end; $$;
create function public.confirm_plan(p_night_id uuid,p_plan jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare n public.nights; total integer; distinct_total integer; registered integer;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden confirmar el reparto.'; end if;
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status <> 'open' then raise exception 'La inscripción está cerrada.'; end if;
 if p_plan is null or jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan)=0 then raise exception 'Reparto no válido.'; end if;
 if exists(select 1 from jsonb_array_elements(p_plan) t where (t->>'size') is null or (t->>'size')::integer not in (4,6,8) or t->>'id' is null or jsonb_typeof(t->'clubIds') is distinct from 'array' or jsonb_array_length(t->'clubIds')<>(t->>'size')::integer) then raise exception 'Solo se permiten torneos completos de 4, 6 u 8 clubes.'; end if;
 select count(*),count(distinct id) into total,distinct_total from jsonb_array_elements(p_plan) t cross join lateral jsonb_array_elements_text(t->'clubIds') ids(id);
 select count(*) into registered from public.registrations where night_id=p_night_id;
 if total<>registered or distinct_total<>registered or exists(select 1 from jsonb_array_elements(p_plan) t cross join lateral jsonb_array_elements_text(t->'clubIds') ids(id) where not exists(select 1 from public.registrations r where r.night_id=p_night_id and r.club_id::text=ids.id)) then raise exception 'Cada club inscrito debe aparecer exactamente una vez.'; end if;
 update public.nights set tournaments=p_plan,status='closed' where id=p_night_id;
end; $$;
create function public.assign_club_captain(p_club_id uuid,p_ea_id text) returns void language plpgsql security definer set search_path = '' as $$
declare captain uuid;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden vincular un capitán.'; end if;
 select id into captain from public.profiles where ea_key=public.normalized_key(p_ea_id);
 if captain is null then raise exception 'El capitán debe crear primero su cuenta.'; end if;
 update public.clubs set owner_id=captain where id=p_club_id and owner_id is null;
 if not found then raise exception 'El club ya tiene capitán o no existe.'; end if;
end; $$;
-- Only the server can resolve EA IDs to the private authentication email.
create function public.auth_email_for_ea(p_ea_id text) returns text language sql stable security definer set search_path = '' as $$
 select u.email::text from public.profiles p join auth.users u on p.id=u.id where p.ea_key=public.normalized_key(p_ea_id);
$$;
create table public.auth_attempts (
 attempt_key text not null check(length(attempt_key)=64),
 window_start bigint not null,
 attempts integer not null default 1,
 primary key(attempt_key,window_start)
);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from public,anon,authenticated;
create function public.consume_auth_attempt(p_key text) returns boolean language plpgsql security definer set search_path = '' as $$
declare attempts integer; slot bigint := floor(extract(epoch from now())/600);
begin
 delete from public.auth_attempts where window_start < slot-144;
 insert into public.auth_attempts(attempt_key,window_start) values(p_key,slot)
 on conflict(attempt_key,window_start) do update set attempts=least(public.auth_attempts.attempts+1,13)
 returning public.auth_attempts.attempts into attempts;
 return attempts <= 12;
end; $$;

revoke execute on function public.normalized_key(text),public.is_admin(),public.handle_new_user(),public.check_contacts(text[]),public.create_my_club(text,text[]),public.update_my_contacts(text[]),public.create_night(text,date,time),public.register_club(uuid,uuid),public.admin_register_club(uuid,text,text[]),public.remove_registration(uuid,uuid),public.confirm_plan(uuid,jsonb),public.assign_club_captain(uuid,text),public.auth_email_for_ea(text),public.consume_auth_attempt(text) from public,anon,authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.create_my_club(text,text[]),public.update_my_contacts(text[]),public.create_night(text,date,time),public.register_club(uuid,uuid),public.admin_register_club(uuid,text,text[]),public.remove_registration(uuid,uuid),public.confirm_plan(uuid,jsonb),public.assign_club_captain(uuid,text) to authenticated;
grant execute on function public.auth_email_for_ea(text),public.consume_auth_attempt(text) to service_role;
