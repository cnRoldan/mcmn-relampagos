create table public.competition_matches (
 id uuid primary key default gen_random_uuid(),
 night_id uuid not null references public.nights(id),
 competition_id text not null,
 phase text not null check(phase in ('league','group','group_a','group_b','semifinal','final')),
 round_number integer not null check(round_number between 1 and 5),
 match_number integer not null check(match_number between 1 and 3),
 home_id uuid not null references public.clubs(id),
 away_id uuid not null references public.clubs(id),
 home_goals integer,
 away_goals integer,
 home_penalties integer,
 away_penalties integer,
 version integer not null default 0,
 updated_by uuid references public.profiles(id),
 updated_at timestamptz not null default now(),
 check(home_id<>away_id),
 check((home_goals is null and away_goals is null) or (home_goals is not null and away_goals is not null and home_goals between 0 and 99 and away_goals between 0 and 99)),
 check((home_penalties is null and away_penalties is null and (phase not in ('semifinal','final') or home_goals is null or home_goals<>away_goals)) or
 (phase in ('semifinal','final') and home_goals is not null and home_goals=away_goals and home_penalties is not null and away_penalties is not null and home_penalties between 0 and 99 and away_penalties between 0 and 99 and home_penalties<>away_penalties)),
 unique(night_id,competition_id,phase,round_number,match_number)
);
alter table public.competition_matches enable row level security;
revoke all on public.competition_matches from public,anon,authenticated;
grant select on public.competition_matches to authenticated;
create policy match_read on public.competition_matches for select to authenticated using((select public.is_active_member()));
create index match_home on public.competition_matches(home_id);
create index match_away on public.competition_matches(away_id);
create index match_updated_by on public.competition_matches(updated_by);

-- Internal deterministic calendar. Runs in the already checked confirm_plan
-- transaction; no client may call it or write fixtures directly.
create function public.seed_competition_matches(p_night_id uuid) returns void
language plpgsql set search_path = '' as $$
declare t jsonb; ids uuid[]; rotated uuid[]; kind text; ph text; groups integer; g integer; r integer; m integer; count_ids integer; home uuid; away uuid;
begin
 for t in select jsonb_array_elements(tournaments) from public.nights where id=p_night_id and status='closed' loop
  kind:=coalesce(t->>'format',case when (t->>'size')::integer=6 then 'liga' else 'copa' end);
  groups:=case when kind='copa' and (t->>'size')::integer=8 then 2 else 1 end;
  for g in 0..groups-1 loop
   select array_agg(v::uuid order by ord) into ids from jsonb_array_elements_text(t->'clubIds') with ordinality a(v,ord)
   where groups=1 or (ord>g*4 and ord<=(g+1)*4);
   count_ids:=cardinality(ids);
   if count_ids not in (4,6) then raise exception 'Calendario no válido.'; end if;
   ph:=case when kind='liga' then 'league' when groups=1 then 'group' when g=0 then 'group_a' else 'group_b' end;
   for r in 1..count_ids-1 loop
    for m in 1..count_ids/2 loop
     home:=case when r%2=0 then ids[count_ids+1-m] else ids[m] end;
     away:=case when r%2=0 then ids[m] else ids[count_ids+1-m] end;
     insert into public.competition_matches(night_id,competition_id,phase,round_number,match_number,home_id,away_id)
     values(p_night_id,t->>'id',ph,r,m,home,away) on conflict do nothing;
    end loop;
    rotated:=array[ids[1],ids[count_ids]]||ids[2:count_ids-1];ids:=rotated;
   end loop;
  end loop;
 end loop;
end; $$;
revoke execute on function public.seed_competition_matches(uuid) from public,anon,authenticated;
create function public.on_competition_started() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.status='closed' and old.status='open' then perform public.seed_competition_matches(new.id); end if;
 return new;
end; $$;
revoke execute on function public.on_competition_started() from public,anon,authenticated;
create trigger competition_started after update of status,tournaments on public.nights for each row execute function public.on_competition_started();
-- Preserve any previously confirmed competitions, without adding users or roles.
do $$ declare n uuid; begin for n in select id from public.nights where status='closed' loop perform public.seed_competition_matches(n); end loop; end; $$;

-- RLS-aware totals, based only on completed group/league games. Playoffs and
-- penalty shootouts never contribute to league points or goals.
create function public.competition_standings(p_night_id uuid,p_competition_id text)
returns table(phase text,club_id uuid,played integer,won integer,drawn integer,lost integer,gf integer,ga integer,gd integer,points integer)
language sql stable security invoker set search_path = '' as $$
 with seeds as (
  select case when coalesce(t->>'format',case when (t->>'size')::integer=6 then 'liga' else 'copa' end)='liga' then 'league'
   when (t->>'size')::integer=4 then 'group' when ord<=4 then 'group_a' else 'group_b' end as ph,v::uuid as club
  from public.nights n cross join lateral jsonb_array_elements(n.tournaments) t
  cross join lateral jsonb_array_elements_text(t->'clubIds') with ordinality a(v,ord)
  where n.id=p_night_id and t->>'id'=p_competition_id
 ), scores as (
  select m.phase as ph,m.home_id as club,m.home_goals as scored,m.away_goals as conceded from public.competition_matches m
  where m.night_id=p_night_id and m.competition_id=p_competition_id and m.phase in ('league','group','group_a','group_b') and m.home_goals is not null
  union all
  select m.phase,m.away_id,m.away_goals,m.home_goals from public.competition_matches m
  where m.night_id=p_night_id and m.competition_id=p_competition_id and m.phase in ('league','group','group_a','group_b') and m.home_goals is not null
 )
 select seed.ph,seed.club,count(s.club)::integer,count(*) filter(where s.scored>s.conceded)::integer,
 count(*) filter(where s.scored=s.conceded)::integer,count(*) filter(where s.scored<s.conceded)::integer,
 coalesce(sum(s.scored),0)::integer,coalesce(sum(s.conceded),0)::integer,coalesce(sum(s.scored-s.conceded),0)::integer,
 coalesce(sum(case when s.scored>s.conceded then 3 when s.scored=s.conceded then 1 else 0 end),0)::integer
 from seeds seed left join scores s on s.ph=seed.ph and s.club=seed.club group by seed.ph,seed.club;
$$;
revoke execute on function public.competition_standings(uuid,text) from public,anon,authenticated;
grant execute on function public.competition_standings(uuid,text) to authenticated;

create function public.check_qualifiers(p_night_id uuid,p_competition_id text,p_phase text,p_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
declare i integer; chosen record;
begin
 if p_ids is null or cardinality(p_ids)<>2 or p_ids[1] is null or p_ids[2] is null or p_ids[1]=p_ids[2] then raise exception 'Elige dos clubes distintos de cada grupo.'; end if;
 for i in 1..2 loop
  select * into chosen from public.competition_standings(p_night_id,p_competition_id) s where s.phase=p_phase and s.club_id=p_ids[i];
  if not found then raise exception 'El clasificado no pertenece a este grupo.'; end if;
  if exists(select 1 from public.competition_standings(p_night_id,p_competition_id) s where s.phase=p_phase and s.club_id<>all(p_ids[1:i]) and (s.points,s.gd,s.gf)>(chosen.points,chosen.gd,chosen.gf)) then
   raise exception 'Respeta puntos, diferencia de goles y goles a favor. Solo puedes decidir entre clubes empatados.';
  end if;
 end loop;
end; $$;
revoke execute on function public.check_qualifiers(uuid,text,text,uuid[]) from public,anon,authenticated;

create function public.start_playoffs(p_night_id uuid,p_competition_id text,p_group_a uuid[],p_group_b uuid[] default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare n public.nights; t jsonb;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden confirmar los clasificados.'; end if;
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status<>'closed' or n.ended_at is not null then raise exception 'El torneo no está en curso.'; end if;
 select v into t from jsonb_array_elements(n.tournaments) v where v->>'id'=p_competition_id;
 if t is null or coalesce(t->>'format',case when (t->>'size')::integer=6 then 'liga' else 'copa' end)<>'copa' then raise exception 'Los playoffs solo están disponibles en Copa.'; end if;
 if exists(select 1 from public.competition_matches where night_id=n.id and competition_id=p_competition_id and phase in ('semifinal','final')) then raise exception 'Los playoffs ya están generados.'; end if;
 if (select count(*) from public.competition_matches where night_id=n.id and competition_id=p_competition_id and phase in ('group','group_a','group_b') and home_goals is not null)<>(case when (t->>'size')::integer=8 then 12 else 6 end) then
  raise exception 'Completa todos los resultados de los grupos antes de generar los playoffs.';
 end if;
 perform public.check_qualifiers(n.id,p_competition_id,case when (t->>'size')::integer=4 then 'group' else 'group_a' end,p_group_a);
 if (t->>'size')::integer=8 then
  perform public.check_qualifiers(n.id,p_competition_id,'group_b',p_group_b);
  insert into public.competition_matches(night_id,competition_id,phase,round_number,match_number,home_id,away_id)
  values(n.id,p_competition_id,'semifinal',1,1,p_group_a[1],p_group_b[2]),(n.id,p_competition_id,'semifinal',1,2,p_group_b[1],p_group_a[2]);
 else
  if p_group_b is null or cardinality(p_group_b)<>0 then raise exception 'Esta Copa solo tiene un grupo.'; end if;
  insert into public.competition_matches(night_id,competition_id,phase,round_number,match_number,home_id,away_id) values(n.id,p_competition_id,'final',1,1,p_group_a[1],p_group_a[2]);
 end if;
end; $$;
revoke execute on function public.start_playoffs(uuid,text,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.start_playoffs(uuid,text,uuid[],uuid[]) to authenticated;

create function public.save_match_result(p_match_id uuid,p_version integer,p_home integer,p_away integer,p_home_penalties integer default null,p_away_penalties integer default null) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.competition_matches; n public.nights; semifinal public.competition_matches; winners uuid[] := '{}';
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden guardar resultados.'; end if;
 select night_id into m.night_id from public.competition_matches where id=p_match_id;
 select * into n from public.nights where id=m.night_id for update;
 if not found or n.status<>'closed' or n.ended_at is not null then raise exception 'El torneo no está en curso.'; end if;
 select * into m from public.competition_matches where id=p_match_id for update;
 if p_version is distinct from m.version then raise exception 'El resultado ha cambiado. Actualiza antes de guardarlo otra vez.'; end if;
 if (m.home_goals,m.away_goals,m.home_penalties,m.away_penalties) is not distinct from (p_home,p_away,p_home_penalties,p_away_penalties) then return; end if;
 if p_home is null and p_away is null and p_home_penalties is null and p_away_penalties is null then null;
 elsif p_home is null or p_away is null or p_home not between 0 and 99 or p_away not between 0 and 99 then raise exception 'Introduce los dos marcadores, entre 0 y 99.';
 elsif m.phase in ('semifinal','final') and p_home=p_away then
  if p_home_penalties is null or p_away_penalties is null or p_home_penalties not between 0 and 99 or p_away_penalties not between 0 and 99 or p_home_penalties=p_away_penalties then raise exception 'Indica una tanda de penaltis con un ganador.'; end if;
 elsif p_home_penalties is not null or p_away_penalties is not null then raise exception 'Los penaltis solo se usan en eliminatorias empatadas.';
 end if;
 if (m.phase in ('league','group','group_a','group_b') and exists(select 1 from public.competition_matches where night_id=n.id and competition_id=m.competition_id and phase in ('semifinal','final'))) or
 (m.phase='semifinal' and exists(select 1 from public.competition_matches where night_id=n.id and competition_id=m.competition_id and phase='final')) then
  raise exception 'Reinicia los playoffs antes de cambiar un resultado que determina sus cruces.';
 end if;
 update public.competition_matches set home_goals=p_home,away_goals=p_away,home_penalties=p_home_penalties,away_penalties=p_away_penalties,version=version+1,updated_by=auth.uid(),updated_at=now() where id=m.id;
 if m.phase='semifinal' and (select count(*) from public.competition_matches where night_id=n.id and competition_id=m.competition_id and phase='semifinal' and home_goals is not null)=2 then
  for semifinal in select * from public.competition_matches where night_id=n.id and competition_id=m.competition_id and phase='semifinal' order by match_number loop
   winners:=array_append(winners,case when semifinal.home_goals>semifinal.away_goals or semifinal.home_penalties>semifinal.away_penalties then semifinal.home_id else semifinal.away_id end);
  end loop;
  insert into public.competition_matches(night_id,competition_id,phase,round_number,match_number,home_id,away_id) values(n.id,m.competition_id,'final',1,1,winners[1],winners[2]);
 end if;
end; $$;
revoke execute on function public.save_match_result(uuid,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.save_match_result(uuid,integer,integer,integer,integer,integer) to authenticated;

create function public.reset_playoffs(p_night_id uuid,p_competition_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.nights;
begin
 if not public.is_admin() then raise exception 'Solo los administradores pueden reiniciar los playoffs.'; end if;
 select * into n from public.nights where id=p_night_id for update;
 if not found or n.status<>'closed' or n.ended_at is not null then raise exception 'El torneo no está en curso.'; end if;
 delete from public.competition_matches where night_id=n.id and competition_id=p_competition_id and phase in ('semifinal','final');
 if not found then raise exception 'Todavía no hay playoffs que reiniciar.'; end if;
end; $$;
revoke execute on function public.reset_playoffs(uuid,text) from public,anon,authenticated;
grant execute on function public.reset_playoffs(uuid,text) to authenticated;
