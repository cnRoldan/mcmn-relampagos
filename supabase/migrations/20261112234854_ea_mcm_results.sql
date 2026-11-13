create table public.club_ea_links (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 edition text not null check(edition='fc27'),platform text not null check(platform in ('common-gen5','nx')),
 ea_club_id text not null check(ea_club_id ~ '^[1-9][0-9]{0,19}$'),ea_name text not null check(length(ea_name) between 1 and 100),
 requested_by uuid references public.profiles(id) on delete set null,requested_at timestamptz not null default now(),
 verified_by uuid references public.profiles(id) on delete set null,verified_at timestamptz,link_version integer not null default 1,
 unique(edition,platform,ea_club_id)
);
alter table public.club_ea_links enable row level security;
revoke all on public.club_ea_links from public,anon,authenticated;
grant select on public.club_ea_links to authenticated;
create policy ea_link_read on public.club_ea_links for select to authenticated using((select public.is_active_member()));
create table public.ea_club_cache(platform text not null,ea_club_id text not null,ea_name text not null,fetched_at timestamptz not null default now(),primary key(platform,ea_club_id));
alter table public.ea_club_cache enable row level security;
revoke all on public.ea_club_cache from public,anon,authenticated;

alter table public.competition_matches add column ea_edition text;
alter table public.competition_matches add column ea_platform text;
alter table public.competition_matches add column ea_match_id text;
alter table public.competition_matches add column ea_played_at timestamptz;
alter table public.competition_matches add column ea_home_red integer check(ea_home_red between 0 and 30);
alter table public.competition_matches add column ea_away_red integer check(ea_away_red between 0 and 30);
alter table public.competition_matches add column result_recorded_at timestamptz;
alter table public.competition_matches add constraint ea_source_complete check(ea_match_id is null or (ea_edition is not null and ea_platform is not null and ea_edition='fc27' and ea_platform in ('common-gen5','nx') and ea_played_at is not null));
create unique index ea_match_once on public.competition_matches(ea_edition,ea_platform,ea_match_id) where ea_match_id is not null;
update public.competition_matches set result_recorded_at=updated_at where home_goals is not null;
create table public.ea_match_candidates (
 id uuid primary key default gen_random_uuid(),mcm_match_id uuid not null references public.competition_matches(id) on delete cascade,
 ea_match_id text not null check(ea_match_id ~ '^[0-9]{1,30}$'),edition text not null,platform text not null,
 home_ea_id text not null,away_ea_id text not null,home_link_version integer not null,away_link_version integer not null,
 played_at timestamptz not null,home_goals integer not null check(home_goals between 0 and 99),away_goals integer not null check(away_goals between 0 and 99),
 home_red integer check(home_red between 0 and 30),away_red integer check(away_red between 0 and 30),fetched_at timestamptz not null default now(),
 unique(mcm_match_id,ea_match_id)
);
alter table public.ea_match_candidates enable row level security;
revoke all on public.ea_match_candidates from public,anon,authenticated;
grant select on public.ea_match_candidates to authenticated;
create policy ea_candidate_read on public.ea_match_candidates for select to authenticated using((select public.is_admin()));

create function public.assert_ea_admin(p_actor uuid) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and not is_banned and not deletion_pending) then raise exception 'Solo los administradores pueden importar y validar resultados de EA.'; end if;
end; $$;
revoke execute on function public.assert_ea_admin(uuid) from public,anon,authenticated;
create function public.set_ea_club_link(p_actor uuid,p_club_id uuid,p_ea_id text,p_platform text,p_edition text,p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare club public.clubs; administrator boolean;
begin
 perform pg_advisory_xact_lock(hashtext('mcm-ea-operations'));
 perform 1 from public.profiles where id=p_actor and not is_banned and not deletion_pending for key share;
 if not found then raise exception 'Tu cuenta no puede vincular clubes.'; end if;
 select exists(select 1 from public.profiles where id=p_actor and role='admin') into administrator;
 select * into club from public.clubs where id=p_club_id and deleted_at is null for update;
 if not found or (not administrator and club.owner_id is distinct from p_actor) then raise exception 'Solo puedes vincular tu propio club.'; end if;
 if exists(select 1 from public.competition_matches where (home_id=club.id or away_id=club.id) and ea_match_id is not null) then raise exception 'Este vínculo ya tiene resultados importados. No se puede sustituir desde aquí.'; end if;
 if p_ea_id is null then delete from public.club_ea_links where club_id=club.id;return;end if;
 if p_edition is distinct from 'fc27' or p_platform is null or p_platform not in ('common-gen5','nx') or p_ea_id !~ '^[1-9][0-9]{0,19}$' or p_name is null or length(p_name) not between 1 and 100 then raise exception 'Datos de EA no válidos.'; end if;
 insert into public.club_ea_links(club_id,edition,platform,ea_club_id,ea_name,requested_by,verified_by,verified_at)
 values(club.id,p_edition,p_platform,p_ea_id,p_name,p_actor,case when administrator then p_actor end,case when administrator then now() end)
 on conflict(club_id) do update set edition=excluded.edition,platform=excluded.platform,ea_club_id=excluded.ea_club_id,ea_name=excluded.ea_name,requested_by=p_actor,requested_at=now(),verified_by=excluded.verified_by,verified_at=excluded.verified_at,link_version=public.club_ea_links.link_version+1;
 delete from public.ea_match_candidates where mcm_match_id in(select id from public.competition_matches where home_id=club.id or away_id=club.id);
end; $$;
create function public.verify_ea_club_link(p_actor uuid,p_club_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('mcm-ea-operations'));perform public.assert_ea_admin(p_actor);
 update public.club_ea_links l set verified_by=p_actor,verified_at=now(),link_version=link_version+1 where club_id=p_club_id and link_version=p_version and exists(select 1 from public.clubs c where c.id=l.club_id and c.deleted_at is null);
 if not found then raise exception 'El vínculo ha cambiado. Actualiza antes de validarlo.'; end if;
end; $$;
create function public.ea_match_context(p_actor uuid,p_match_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.competition_matches;n public.nights;h public.club_ea_links;a public.club_ea_links;start_at timestamptz;
begin
 perform public.assert_ea_admin(p_actor);
 select * into m from public.competition_matches where id=p_match_id;
 if not found then raise exception 'Partido MCM no encontrado.';end if;
 select * into n from public.nights where id=m.night_id;
 if n.status<>'closed' or n.ended_at is not null then raise exception 'El torneo MCM no está en curso.';end if;
 select * into h from public.club_ea_links where club_id=m.home_id and verified_at is not null;
 if not found then raise exception 'Falta validar el vínculo EA del primer club.';end if;
 select * into a from public.club_ea_links where club_id=m.away_id and verified_at is not null;
 if not found then raise exception 'Falta validar el vínculo EA del segundo club.';end if;
 if h.edition<>a.edition or h.platform<>a.platform then raise exception 'Los clubes no pertenecen al mismo grupo de EA.';end if;
 start_at:=greatest(((n.play_date+n.start_time) at time zone 'Europe/Madrid')+make_interval(mins=>n.grace_minutes),h.verified_at,a.verified_at);
 return jsonb_build_object('home_ea_id',h.ea_club_id,'away_ea_id',a.ea_club_id,'platform',h.platform,'edition',h.edition,'start_at',start_at,'home_link_version',h.link_version,'away_link_version',a.link_version,'version',m.version);
end; $$;
create function public.cache_ea_match_candidates(p_actor uuid,p_match_id uuid,p_context jsonb,p_rows jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare context jsonb;r jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('mcm-ea-operations'));context:=public.ea_match_context(p_actor,p_match_id);
 if context is distinct from p_context then raise exception 'El partido o sus vínculos han cambiado. Repite la búsqueda.';end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10 then raise exception 'Respuesta de partidos no válida.';end if;
 for r in select jsonb_array_elements(p_rows) loop
  if (r->>'played_at')::timestamptz<(context->>'start_at')::timestamptz or (r->>'played_at')::timestamptz>now()+interval '5 minutes' then raise exception 'El partido EA está fuera de la ventana del torneo.';end if;
  insert into public.ea_match_candidates(mcm_match_id,ea_match_id,edition,platform,home_ea_id,away_ea_id,home_link_version,away_link_version,played_at,home_goals,away_goals,home_red,away_red)
  values(p_match_id,r->>'ea_match_id',context->>'edition',context->>'platform',context->>'home_ea_id',context->>'away_ea_id',(context->>'home_link_version')::integer,(context->>'away_link_version')::integer,(r->>'played_at')::timestamptz,(r->>'home_goals')::integer,(r->>'away_goals')::integer,(r->>'home_red')::integer,(r->>'away_red')::integer)
  on conflict(mcm_match_id,ea_match_id) do update set home_goals=excluded.home_goals,away_goals=excluded.away_goals,home_red=excluded.home_red,away_red=excluded.away_red,played_at=excluded.played_at,fetched_at=now(),home_link_version=excluded.home_link_version,away_link_version=excluded.away_link_version;
 end loop;
end; $$;
revoke execute on function public.set_ea_club_link(uuid,uuid,text,text,text,text),public.verify_ea_club_link(uuid,uuid,integer),public.ea_match_context(uuid,uuid),public.cache_ea_match_candidates(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.set_ea_club_link(uuid,uuid,text,text,text,text),public.verify_ea_club_link(uuid,uuid,integer),public.ea_match_context(uuid,uuid),public.cache_ea_match_candidates(uuid,uuid,jsonb,jsonb) to service_role;

create table public.club_elo(club_id uuid primary key references public.clubs(id) on delete cascade,rating double precision not null default 1000,played integer not null default 0,won integer not null default 0,drawn integer not null default 0,lost integer not null default 0,gf integer not null default 0,ga integer not null default 0);
create table public.club_elo_history(match_id uuid not null references public.competition_matches(id) on delete cascade,club_id uuid not null references public.clubs(id) on delete cascade,opponent_id uuid not null references public.clubs(id),played_at timestamptz not null,rating_before double precision not null,rating_after double precision not null,delta double precision not null,rule_version text not null default 'elo-v1-k32',primary key(match_id,club_id));
create index elo_club_history on public.club_elo_history(club_id,played_at);
create index elo_opponent_history on public.club_elo_history(opponent_id);
alter table public.club_elo enable row level security;alter table public.club_elo_history enable row level security;
revoke all on public.club_elo,public.club_elo_history from public,anon,authenticated;
grant select on public.club_elo,public.club_elo_history to authenticated;
create policy elo_read on public.club_elo for select to authenticated using((select public.is_active_member()));
create policy elo_history_read on public.club_elo_history for select to authenticated using((select public.is_active_member()));
create function public.rebuild_mcm_elo() returns void language plpgsql security definer set search_path='' as $$
declare m public.competition_matches;rh double precision;ra double precision;expected double precision;s double precision;d double precision;played_time timestamptz;
begin
 perform pg_advisory_xact_lock(hashtext('mcm-elo-rebuild'));
 delete from public.club_elo_history;delete from public.club_elo;
 insert into public.club_elo(club_id) select id from public.clubs;
 for m in select g.* from public.competition_matches g join public.nights n on n.id=g.night_id where g.home_goals is not null and g.away_goals is not null and n.status='closed' order by coalesce(g.ea_played_at,g.result_recorded_at,g.updated_at),g.id loop
  select rating into rh from public.club_elo where club_id=m.home_id;select rating into ra from public.club_elo where club_id=m.away_id;
  expected:=1.0/(1.0+power(10.0,(ra-rh)/400.0));
  s:=case when m.home_goals>m.away_goals then 1.0 when m.home_goals<m.away_goals then 0.0 when m.home_penalties>m.away_penalties then 1.0 when m.home_penalties<m.away_penalties then 0.0 else 0.5 end;
  d:=32.0*(s-expected);played_time:=coalesce(m.ea_played_at,m.result_recorded_at,m.updated_at);
  insert into public.club_elo_history(match_id,club_id,opponent_id,played_at,rating_before,rating_after,delta) values(m.id,m.home_id,m.away_id,played_time,rh,rh+d,d),(m.id,m.away_id,m.home_id,played_time,ra,ra-d,-d);
  update public.club_elo set rating=rh+d,played=played+1,won=won+(s=1)::integer,drawn=drawn+(s=0.5)::integer,lost=lost+(s=0)::integer,gf=gf+m.home_goals,ga=ga+m.away_goals where club_id=m.home_id;
  update public.club_elo set rating=ra-d,played=played+1,won=won+(s=0)::integer,drawn=drawn+(s=0.5)::integer,lost=lost+(s=1)::integer,gf=gf+m.away_goals,ga=ga+m.home_goals where club_id=m.away_id;
 end loop;
end; $$;
revoke execute on function public.rebuild_mcm_elo() from public,anon,authenticated;
create function public.mark_mcm_result_time() returns trigger language plpgsql set search_path='' as $$
begin
 if new.home_goals is null then new.result_recorded_at:=null;new.ea_edition:=null;new.ea_platform:=null;new.ea_match_id:=null;new.ea_played_at:=null;new.ea_home_red:=null;new.ea_away_red:=null;
 elsif old.home_goals is null then new.result_recorded_at:=now();end if;
 return new;
end; $$;
create function public.refresh_mcm_elo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then if old.home_goals is not null then perform public.rebuild_mcm_elo();end if;
 elsif new.home_goals is not null or old.home_goals is not null then perform public.rebuild_mcm_elo();end if;
 return null;
end; $$;
revoke execute on function public.mark_mcm_result_time(),public.refresh_mcm_elo() from public,anon,authenticated;
create trigger mark_result_time before update on public.competition_matches for each row execute function public.mark_mcm_result_time();
create trigger refresh_elo after update of home_goals,away_goals,home_penalties,away_penalties,ea_played_at or delete on public.competition_matches for each row execute function public.refresh_mcm_elo();

create function public.record_mcm_result(p_actor uuid,p_match_id uuid,p_version integer,p_home integer,p_away integer,p_home_penalties integer default null,p_away_penalties integer default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare m public.competition_matches; n public.nights; semifinal public.competition_matches; winners uuid[] := '{}';
begin
 perform public.assert_ea_admin(p_actor);
 select night_id into m.night_id from public.competition_matches where id=p_match_id;
 select * into n from public.nights where id=m.night_id for update;
 if not found or n.status<>'closed' or n.ended_at is not null then raise exception 'El torneo no está en curso.'; end if;
 select * into m from public.competition_matches where id=p_match_id for update;
 if m.ea_match_id is not null and p_home is not null and (m.home_goals,m.away_goals,m.home_penalties,m.away_penalties) is distinct from (p_home,p_away,p_home_penalties,p_away_penalties) then raise exception 'Deja el resultado pendiente antes de sustituir una importación EA.'; end if;
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
 update public.competition_matches set home_goals=p_home,away_goals=p_away,home_penalties=p_home_penalties,away_penalties=p_away_penalties,version=version+1,updated_by=p_actor,updated_at=now() where id=m.id;
 if m.phase='semifinal' and (select count(*) from public.competition_matches where night_id=n.id and competition_id=m.competition_id and phase='semifinal' and home_goals is not null)=2 then
  for semifinal in select * from public.competition_matches where night_id=n.id and competition_id=m.competition_id and phase='semifinal' order by match_number loop
   winners:=array_append(winners,case when semifinal.home_goals>semifinal.away_goals or semifinal.home_penalties>semifinal.away_penalties then semifinal.home_id else semifinal.away_id end);
  end loop;
  insert into public.competition_matches(night_id,competition_id,phase,round_number,match_number,home_id,away_id) values(n.id,m.competition_id,'final',1,1,winners[1],winners[2]);
 end if;
end; $$;
revoke execute on function public.record_mcm_result(uuid,uuid,integer,integer,integer,integer,integer) from public,anon,authenticated;
create or replace function public.save_match_result(p_match_id uuid,p_version integer,p_home integer,p_away integer,p_home_penalties integer default null,p_away_penalties integer default null) returns void language plpgsql security definer set search_path='' as $$
begin perform public.record_mcm_result(auth.uid(),p_match_id,p_version,p_home,p_away,p_home_penalties,p_away_penalties);end; $$;
create function public.import_ea_match(p_actor uuid,p_candidate_id uuid,p_version integer,p_hp integer default null,p_ap integer default null) returns void language plpgsql security definer set search_path='' as $$
declare c public.ea_match_candidates;m public.competition_matches;context jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('mcm-ea-operations'));perform public.assert_ea_admin(p_actor);
 select * into c from public.ea_match_candidates where id=p_candidate_id;
 if not found then raise exception 'Candidato de EA no encontrado.';end if;
 perform 1 from public.nights where id=(select night_id from public.competition_matches where id=c.mcm_match_id) for update;
 context:=public.ea_match_context(p_actor,c.mcm_match_id);
 select * into m from public.competition_matches where id=c.mcm_match_id for update;
 if m.ea_match_id=c.ea_match_id and m.ea_edition=c.edition and m.ea_platform=c.platform then return;end if;
 if m.ea_match_id is not null then raise exception 'Este partido ya tiene una importación. Déjalo pendiente para corregirla.';end if;
 if m.version is distinct from p_version then raise exception 'El resultado ha cambiado. Actualiza antes de importarlo.';end if;
 if c.home_link_version<>(context->>'home_link_version')::integer or c.away_link_version<>(context->>'away_link_version')::integer or c.home_ea_id<>context->>'home_ea_id' or c.away_ea_id<>context->>'away_ea_id' or c.platform<>context->>'platform' or c.edition<>context->>'edition' or c.played_at<(context->>'start_at')::timestamptz then raise exception 'Los vínculos EA han cambiado. Repite la búsqueda.';end if;
 if exists(select 1 from public.competition_matches where ea_edition=c.edition and ea_platform=c.platform and ea_match_id=c.ea_match_id and id<>m.id) then raise exception 'Ese partido de EA ya está asignado a otro encuentro MCM.';end if;
 perform public.record_mcm_result(p_actor,m.id,p_version,c.home_goals,c.away_goals,p_hp,p_ap);
 update public.competition_matches set ea_edition=c.edition,ea_platform=c.platform,ea_match_id=c.ea_match_id,ea_played_at=c.played_at,ea_home_red=c.home_red,ea_away_red=c.away_red where id=m.id;
end; $$;
revoke execute on function public.import_ea_match(uuid,uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.import_ea_match(uuid,uuid,integer,integer,integer) to service_role;
select public.rebuild_mcm_elo();

create or replace function public.erase_owned_club(p_owner_id uuid) returns void language plpgsql set search_path = '' as $$
declare club uuid; tournament uuid;
begin
 perform 1 from public.profiles where id=p_owner_id for update;
 select id into club from public.clubs where owner_id=p_owner_id and deleted_at is null;
 if club is null then return; end if;
 for tournament in select n.id from public.nights n where exists(select 1 from public.registrations r where r.night_id=n.id and r.club_id=club) order by n.id for update loop null; end loop;
 perform 1 from public.clubs where id=club for update;
 delete from public.club_ea_links where club_id=club;
 delete from public.ea_match_candidates where mcm_match_id in(select id from public.competition_matches where home_id=club or away_id=club);
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
create function public.mcm_club_history(p_club_id uuid,p_offset integer default 0) returns table(match_id uuid,played_at timestamptz,tournament_name text,phase text,round_number integer,opponent_name text,my_goals integer,their_goals integer,my_penalties integer,their_penalties integer,rating_before double precision,rating_after double precision,delta double precision,ea_match_id text,red_cards integer)
language sql stable security invoker set search_path='' as $$
 select h.match_id,h.played_at,n.name,m.phase,m.round_number,case when opponent.deleted_at is not null then 'Club eliminado' else opponent.name end,
 case when m.home_id=p_club_id then m.home_goals else m.away_goals end,case when m.home_id=p_club_id then m.away_goals else m.home_goals end,
 case when m.home_id=p_club_id then m.home_penalties else m.away_penalties end,case when m.home_id=p_club_id then m.away_penalties else m.home_penalties end,
 h.rating_before,h.rating_after,h.delta,m.ea_match_id,case when m.home_id=p_club_id then m.ea_home_red else m.ea_away_red end
 from public.club_elo_history h join public.competition_matches m on m.id=h.match_id join public.nights n on n.id=m.night_id join public.clubs opponent on opponent.id=h.opponent_id
 where h.club_id=p_club_id order by h.played_at desc,h.match_id limit 50 offset greatest(0,least(coalesce(p_offset,0),100000));
$$;
revoke execute on function public.mcm_club_history(uuid,integer) from public,anon,authenticated;
grant execute on function public.mcm_club_history(uuid,integer) to authenticated;
