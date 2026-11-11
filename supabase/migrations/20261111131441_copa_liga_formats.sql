-- Copa: groups and knockouts. Liga: a single round-robin with no extra final.
-- Supported combinations all respect the agreed five-match limit.
create function public.check_competition_plan(p_plan jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare tournament jsonb; kind text; teams integer;
begin
 if p_plan is null or jsonb_typeof(p_plan) <> 'array' or jsonb_array_length(p_plan)=0 then raise exception 'Reparto no válido.'; end if;
 for tournament in select value from jsonb_array_elements(p_plan) loop
  if jsonb_typeof(tournament) <> 'object'
    or jsonb_typeof(tournament->'id') is distinct from 'string'
    or length(btrim(tournament->>'id'))=0
    or (tournament->>'size') is null
    or (tournament->>'size') not in ('4','6','8')
    or jsonb_typeof(tournament->'clubIds') is distinct from 'array' then
   raise exception 'Cada torneo debe tener un identificador, un número de equipos válido y sus participantes.';
  end if;
  teams := (tournament->>'size')::integer;
  if jsonb_array_length(tournament->'clubIds') <> teams then raise exception 'Completa las plazas de todos los torneos.'; end if;
  kind := coalesce(tournament->>'format', case when teams=6 then 'liga' else 'copa' end);
  if kind not in ('copa','liga') then raise exception 'Elige Copa o Liga.'; end if;
  if (kind='liga' and teams not in (4,6)) or (kind='copa' and teams not in (4,8)) then
   raise exception 'Ese formato no está disponible con este número de equipos y el límite de cinco partidos.';
  end if;
 end loop;
 if (select count(*) <> count(distinct t->>'id') from jsonb_array_elements(p_plan) t) then raise exception 'Cada torneo debe tener un identificador distinto.'; end if;
end; $$;
revoke execute on function public.check_competition_plan(jsonb) from public,anon,authenticated;

create or replace function public.confirm_plan(p_night_id uuid,p_plan jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.nights; total integer; distinct_total integer; registered integer; normalized_plan jsonb;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden crear y configurar los torneos.'; end if;
 -- Pure validation before taking the shared registration/closure lock.
 perform public.check_competition_plan(p_plan);
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status <> 'open' then raise exception 'La inscripción está cerrada.'; end if;
 select count(*),count(distinct id) into total,distinct_total from jsonb_array_elements(p_plan) t cross join lateral jsonb_array_elements_text(t->'clubIds') ids(id);
 select count(*) into registered from public.registrations where night_id=p_night_id;
 if total<>registered or distinct_total<>registered or exists(select 1 from jsonb_array_elements(p_plan) t cross join lateral jsonb_array_elements_text(t->'clubIds') ids(id) where not exists(select 1 from public.registrations r where r.night_id=p_night_id and r.club_id::text=ids.id)) then raise exception 'Cada club inscrito debe aparecer exactamente una vez.'; end if;
 -- Older clients omit format; normalize their existing, already agreed rules.
 select jsonb_agg(t || jsonb_build_object('format',coalesce(t->>'format',case when (t->>'size')::integer=6 then 'liga' else 'copa' end)) order by ordinal)
 into normalized_plan from jsonb_array_elements(p_plan) with ordinality entries(t,ordinal);
 update public.nights set tournaments=normalized_plan,status='closed' where id=p_night_id;
end; $$;
revoke execute on function public.confirm_plan(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_plan(uuid,jsonb) to authenticated;
