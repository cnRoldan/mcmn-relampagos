import React, { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../cloud/client";
import { useAuth } from "../cloud/AuthProvider";
import type { Club, Data, Night, Tournament } from "../domain/tournaments";
import { emptyData } from "../domain/tournaments";
import { useTournamentLink } from "../cloud/links";
import { validateContacts } from "../domain/contacts";
import type { EaLink, McmStats, EloEntry } from "../domain/ea";
import type { Match } from "../domain/results";
import { C, Context, Member } from "./context";
type TournamentRow = {
  id: string;
  name: string;
  play_date: string;
  start_time: string;
  tournaments: Tournament[];
  rules: string;
  grace_minutes: number;
  effective_start: string;
  ended_at: string | null;
};
type ClubRow = {
  id: string;
  name: string;
  owner_id: string | null;
  deleted_at: string | null;
  badge_path: string | null;
  club_version: number;
};
type RegistrationRow = {
  night_id: string;
  club_id: string;
  registration_number: number;
  registered_at: string;
  id: string;
  excluded: boolean;
};
export function CloudProvider({ children }: { children: React.ReactNode }) {
  const initialId = useTournamentLink();
  const { session, profile } = useAuth(),
    [data, setData] = useState<Data>(emptyData),
    [myClub, setMyClub] = useState<Club>(),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    request = useRef(0);
  const isAdmin = profile?.role === "admin";
  async function refresh() {
    if (!supabase || !session) return;
    const attempt = ++request.current;
    try {
      const results = await Promise.all([
        supabase.rpc("list_tournaments_with_status"),
        supabase
          .from("clubs")
          .select("id,name,owner_id,deleted_at,badge_path,club_version"),
        supabase
          .from("registrations")
          .select(
            "id,night_id,club_id,registration_number,registered_at,excluded",
          )
          .order("registration_number"),
        supabase.from("club_contacts").select("club_id,phones"),
        supabase
          .from("registration_notices")
          .select("registration_id,reason,excluded"),
        supabase
          .from("competition_matches")
          .select(
            "id,night_id,competition_id,phase,round_number,match_number,home_id,away_id,home_goals,away_goals,home_penalties,away_penalties,version,ea_match_id,ea_played_at,ea_home_red,ea_away_red",
          )
          .order("round_number")
          .order("match_number"),
        supabase
          .from("club_ea_links")
          .select(
            "club_id,edition,platform,ea_club_id,ea_name,verified_at,link_version",
          ),
        supabase
          .from("club_elo")
          .select("club_id,rating,played,won,drawn,lost,gf,ga"),
      ]);
      const failed = results.find((r) => r.error);
      if (failed?.error)
        throw new Error(
          "No se ha podido actualizar la información del servidor.",
        );
      if (!alive.current || attempt !== request.current) return;
      const clubs = (results[1].data || []) as ClubRow[],
        regs = (results[2].data || []) as RegistrationRow[],
        contacts = new Map(
          (results[3].data || []).map((c) => [c.club_id, c.phones as string[]]),
        );
      const badgePaths = clubs
        .filter((c) => !c.deleted_at && c.badge_path)
        .map((c) => c.badge_path!);
      const badgeUrls = new Map<string, string>();
      if (badgePaths.length) {
        const { data: urls, error: badgeError } = await supabase.storage
          .from("club-badges")
          .createSignedUrls(badgePaths, 120);
        if (!badgeError)
          for (const item of urls || [])
            if (item.path && item.signedUrl)
              badgeUrls.set(item.path, item.signedUrl);
      }
      if (!alive.current || attempt !== request.current) return;
      const mapClub = (c: ClubRow): Club => ({
        id: c.id,
        name: c.deleted_at ? `Club eliminado · ${c.id.slice(0, 6)}` : c.name,
        deletedAt: c.deleted_at,
        badgePath: c.badge_path,
        badgeUrl: c.badge_path ? badgeUrls.get(c.badge_path) || null : null,
        clubVersion: c.club_version ?? 0,
        contacts: contacts.get(c.id) || [],
        eaLink: ((results[6].data || []) as EaLink[]).find(
          (l) => l.club_id === c.id,
        ),
        mcmStats: ((results[7].data || []) as McmStats[]).find(
          (l) => l.club_id === c.id,
        ),
        captainId: c.owner_id,
      });
      const notices = new Map(
        (results[4].data || []).map((n) => [
          n.registration_id,
          n.reason as string,
        ]),
      );
      const nights: Night[] = ((results[0].data || []) as TournamentRow[]).map(
        (n) => ({
          id: n.id,
          name: n.name,
          date: n.play_date,
          time: n.start_time.slice(0, 5),
          tournaments: n.tournaments,
          rules: n.rules,
          graceMinutes: n.grace_minutes,
          effectiveStart: n.effective_start,
          endedAt: n.ended_at,
          matches: ((results[5].data || []) as Match[]).filter(
            (m) => m.night_id === n.id,
          ),
          singleTournament: true,
          clubs: regs
            .filter((r) => r.night_id === n.id)
            .map((r) => {
              const c = clubs.find((c) => c.id === r.club_id);
              if (!c) throw new Error("No se pudo leer un club inscrito.");
              return {
                ...mapClub(c),
                registrationOrder: Number(r.registration_number),
                registeredAt: r.registered_at,
                excluded: r.excluded,
                exclusionReason: notices.get(r.id),
              };
            }),
        }),
      );
      const own = clubs.find((c) => c.owner_id === session.user.id);
      setMyClub(own ? mapClub(own) : undefined);
      setData((d) => ({
        version: 1,
        nights,
        activeId: nights.some((n) => n.id === d.activeId)
          ? d.activeId
          : nights.find((n) => n.id === initialId)?.id ||
            nights.find((n) => !n.tournaments.length)?.id ||
            nights[0]?.id ||
            null,
      }));
      setError("");
    } catch (e) {
      if (alive.current && attempt === request.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo conectar con el servidor.",
        );
      throw e;
    } finally {
      if (alive.current && attempt === request.current) setReady(true);
    }
  }
  useEffect(() => {
    alive.current = true;
    void refresh().catch(() => {});
    const timer = setInterval(() => void refresh().catch(() => {}), 20000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh().catch(() => {});
    });
    return () => {
      alive.current = false;
      request.current++;
      clearInterval(timer);
      listener.remove();
    };
  }, [session?.user.id, profile?.role]);
  async function rpc(name: string, args: Record<string, unknown>) {
    if (!supabase || !session) throw new Error("Inicia sesión.");
    const { data: result, error } = await supabase.rpc(name, args);
    if (error) {
      if (error.code === "23505")
        throw new Error(
          "Este club o ID ya existe. Si tu club fue añadido por un administrador, solicita que lo vincule a tu cuenta.",
        );
      throw new Error(error.message);
    }
    try {
      await refresh();
    } catch {
      throw new Error(
        "La operación se ha guardado, pero la lista no pudo actualizarse. Pulsa Actualizar antes de repetirla.",
      );
    }
    return result;
  }
  async function clubRequest(body: Record<string, unknown>) {
    if (!supabase || !session) throw new Error("Inicia sesión.");
    const { data: result, error } = await supabase.functions.invoke(
      "club-profile",
      { body },
    );
    if (error || !(result?.saved || result?.deleted)) {
      let message = "No se pudo guardar el club. Inténtalo de nuevo.";
      try {
        message = (await error?.context.json())?.error || message;
      } catch {}
      throw new Error(message);
    }
    try {
      await refresh();
    } catch {
      throw new Error(
        "El cambio se ha guardado, pero no se pudo actualizar la pantalla. Pulsa Actualizar antes de repetirlo.",
      );
    }
  }
  async function eaRequest(body: Record<string, unknown>, reload = false) {
    const { data: result, error } = await supabase!.functions.invoke(
      "ea-clubs",
      { body },
    );
    if (error) {
      let message = "No se pudo completar la operación de EA.";
      try {
        message = (await error.context.json()).error || message;
      } catch {}
      throw new Error(message);
    }
    if (reload)
      try {
        await refresh();
      } catch {
        throw new Error(
          "La operación se guardó, pero no se pudo actualizar la pantalla. Pulsa Actualizar.",
        );
      }
    return result;
  }
  const active = data.nights.find((n) => n.id === data.activeId);
  function current() {
    if (!active) throw new Error("Selecciona un torneo.");
    return active.id;
  }
  const value: Context = {
    lookupEaClub: async (input) =>
      (await eaRequest({ action: "lookup", input })).club,
    linkEaClub: async (clubId, input) => {
      await eaRequest({ action: "link", club_id: clubId, input }, true);
    },
    unlinkEaClub: async (clubId) => {
      await eaRequest({ action: "unlink", club_id: clubId }, true);
    },
    verifyEaClub: async (clubId, version) => {
      await eaRequest({ action: "verify", club_id: clubId, version }, true);
    },
    findEaResults: (matchId) =>
      eaRequest({ action: "candidates", match_id: matchId }),
    importEaResult: async (match, candidateId, hp, ap) => {
      await eaRequest(
        {
          action: "import",
          candidate_id: candidateId,
          version: match.version,
          home_penalties: hp,
          away_penalties: ap,
        },
        true,
      );
    },
    clubHistory: async (clubId, offset) => {
      const { data: rows, error } = await supabase!.rpc("mcm_club_history", {
        p_club_id: clubId,
        p_offset: offset,
      });
      if (error) throw new Error("No se pudo cargar el historial MCM.");
      return rows as EloEntry[];
    },
    mode: "cloud",
    isAdmin,
    myClub,
    data,
    night: active,
    ready,
    error,
    refresh,
    select: async (id) => {
      if (!data.nights.some((n) => n.id === id))
        throw new Error("Torneo no encontrado.");
      setData((d) => ({ ...d, activeId: id }));
    },
    createNight: async (name, date, time, rules = "") => {
      const id = await rpc("create_tournament", {
        p_name: name.trim(),
        p_date: date,
        p_time: time,
        p_rules: rules,
      });
      setData((d) => ({ ...d, activeId: id }));
    },
    saveResult: (match, score) =>
      rpc("save_match_result", {
        p_match_id: match.id,
        p_version: match.version,
        p_home: score.home,
        p_away: score.away,
        p_home_penalties: score.homePenalties ?? null,
        p_away_penalties: score.awayPenalties ?? null,
      }),
    startPlayoffs: (competitionId, groupA, groupB) =>
      rpc("start_playoffs", {
        p_night_id: current(),
        p_competition_id: competitionId,
        p_group_a: groupA,
        p_group_b: groupB,
      }),
    resetPlayoffs: (competitionId) =>
      rpc("reset_playoffs", {
        p_night_id: current(),
        p_competition_id: competitionId,
      }),
    finishTournament: () =>
      rpc("finish_tournament", { p_tournament_id: current() }),
    extendStart: (minutes) =>
      rpc("extend_tournament_start", {
        p_tournament_id: current(),
        p_minutes: minutes,
      }),
    setExcluded: (id, excluded, reason) =>
      rpc("set_registration_excluded", {
        p_tournament_id: current(),
        p_club_id: id,
        p_excluded: excluded,
        p_reason: reason,
      }),
    listMembers: async () => {
      const { data, error } = await supabase!
        .from("profiles")
        .select("id,ea_id,role,is_banned,ban_reason")
        .order("ea_id");
      if (error) throw new Error("No se pudieron cargar los capitanes.");
      return data as Member[];
    },
    setMemberBan: (id, banned, reason) =>
      rpc("set_member_ban", {
        p_member_id: id,
        p_banned: banned,
        p_reason: reason,
      }),
    addClub: (name, contacts) =>
      rpc("admin_register_club", {
        p_night_id: current(),
        p_name: name.trim(),
        p_contacts: validateContacts(contacts),
      }),
    removeClub: (id) =>
      rpc("set_registration_excluded", {
        p_tournament_id: current(),
        p_club_id: id,
        p_excluded: true,
        p_reason: "Club fuera por decisión de la organización.",
      }),
    confirmPlan: (plan) =>
      rpc("confirm_plan", { p_night_id: current(), p_plan: plan }),
    deleteMyClub: (confirmation) =>
      clubRequest({ action: "delete", confirmation }),
    saveMyClub: (name, contacts, badge) =>
      clubRequest({
        action: "save",
        name: name.trim(),
        contacts: validateContacts(contacts),
        version: null,
        ...(badge !== undefined ? { badge } : {}),
      }),
    updateMyClub: (name, contacts, badge) => {
      if (!myClub) throw new Error("No tienes un club vinculado.");
      return clubRequest({
        action: "save",
        name: name.trim(),
        contacts: validateContacts(contacts),
        version: myClub.clubVersion ?? 0,
        ...(badge !== undefined ? { badge } : {}),
      });
    },
    updateContacts: (contacts) =>
      rpc("update_my_contacts", {
        p_contacts: validateContacts(contacts),
      }),
    registerMyClub: (acceptRules = false) => {
      if (!myClub) throw new Error("Crea o vincula tu club primero.");
      return rpc("join_tournament", {
        p_tournament_id: current(),
        p_accept_rules: acceptRules,
      });
    },
    assignCaptain: (clubId, eaId) =>
      rpc("assign_club_captain", { p_club_id: clubId, p_ea_id: eaId.trim() }),
    loadDemo: async () => {
      throw new Error("Los ejemplos locales no se copian al servidor.");
    },
    reset: async () => {
      throw new Error(
        "Los datos compartidos no se borran desde el dispositivo.",
      );
    },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
