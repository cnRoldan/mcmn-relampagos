-- One explicit end marker keeps finished competitions out of Home.
alter table public.nights add column ended_at timestamptz;
create function public.finish_tournament(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden finalizar el torneo.'; end if;
 update public.nights set ended_at=now() where id=p_tournament_id and status='closed' and ended_at is null;
 if not found then raise exception 'El torneo no está en curso.'; end if;
end; $$;
revoke execute on function public.finish_tournament(uuid) from public,anon,authenticated;
grant execute on function public.finish_tournament(uuid) to authenticated;

create function public.list_tournaments_with_status() returns table(id uuid,name text,play_date date,start_time time,status text,tournaments jsonb,rules text,grace_minutes integer,effective_start timestamptz,ended_at timestamptz)
language sql stable security invoker set search_path = '' as $$
 select n.id,n.name,n.play_date,n.start_time,n.status,n.tournaments,n.rules,n.grace_minutes,
 ((n.play_date+n.start_time) at time zone 'Europe/Madrid')+make_interval(mins=>n.grace_minutes),n.ended_at
 from public.nights n order by n.created_at;
$$;
revoke execute on function public.list_tournaments_with_status() from public,anon,authenticated;
grant execute on function public.list_tournaments_with_status() to authenticated;
create or replace function public.get_public_tournament(p_tournament_id uuid) returns table(id uuid,name text,play_date date,start_time time,rules text,status text,grace_minutes integer,effective_start timestamptz,registered_count bigint)
language sql stable security definer set search_path = '' as $$
 select n.id,n.name,n.play_date,n.start_time,n.rules,case when n.ended_at is not null then 'finished' else n.status end,n.grace_minutes,
 ((n.play_date+n.start_time) at time zone 'Europe/Madrid')+make_interval(mins=>n.grace_minutes),
 (select count(*) from public.registrations r where r.night_id=n.id)
 from public.nights n where n.id=p_tournament_id;
$$;

-- Active captains in the same tournament may contact each other, while
-- unrelated users, excluded clubs and anonymous visitors cannot read phones.
alter policy contact_read on public.club_contacts using (
 (select public.is_active_member()) and (
  (select public.is_admin()) or
  exists(select 1 from public.clubs c where c.id=club_contacts.club_id and c.owner_id=(select auth.uid())) or
  exists(
   select 1 from public.registrations target
   join public.registrations mine on mine.night_id=target.night_id
   join public.clubs own_club on own_club.id=mine.club_id
   join public.nights n on n.id=target.night_id
   where target.club_id=club_contacts.club_id and not target.excluded and not mine.excluded
   and own_club.owner_id=(select auth.uid()) and n.ended_at is null
  )
 )
);
create index registration_club_lookup on public.registrations(club_id,night_id);

-- Enforce explicit international prefixes without assuming a country.
create or replace function public.check_contacts(phones text[]) returns void language plpgsql set search_path = '' as $$
begin
 if phones is null or cardinality(phones) not between 1 and 3 or exists(
  select 1 from unnest(phones) p where p is null or length(p)>24 or btrim(p) !~ '^[+0-9 ()-]+$'
  or regexp_replace(regexp_replace(btrim(p),'[ ()-]','','g'),'^00','+') !~ '^\+[1-9][0-9]{7,14}$'
 ) then
  raise exception 'Añade al menos un teléfono válido con prefijo internacional, por ejemplo +34 612 345 678. Máximo tres.';
 end if;
end; $$;
-- Existing clubs keep their data; a new inscription requires a valid phone.
create function public.require_registration_contact() returns trigger language plpgsql set search_path = '' as $$
begin
 perform public.check_contacts((select phones from public.club_contacts where club_id=new.club_id));
 return new;
end; $$;
revoke execute on function public.require_registration_contact() from public,anon,authenticated;
create trigger registration_contact_required before insert on public.registrations for each row execute function public.require_registration_contact();
