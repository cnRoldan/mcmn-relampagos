import React, { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../cloud/client";
import { useAuth } from "../cloud/AuthProvider";
import type { Club, Data, Night } from "../domain/tournaments";
import { emptyData } from "../domain/tournaments";
import { C, Context } from "./context";
type ClubRow = { id: string; name: string; owner_id: string | null };
type RegistrationRow = {
  night_id: string;
  club_id: string;
  registration_number: number;
  registered_at: string;
};
export function CloudProvider({ children }: { children: React.ReactNode }) {
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
        supabase
          .from("nights")
          .select("id,name,play_date,start_time,status,tournaments")
          .order("created_at"),
        supabase.from("clubs").select("id,name,owner_id"),
        supabase
          .from("registrations")
          .select("night_id,club_id,registration_number,registered_at")
          .order("registration_number"),
        supabase.from("club_contacts").select("club_id,phones"),
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
      const mapClub = (c: ClubRow): Club => ({
        id: c.id,
        name: c.name,
        contacts: contacts.get(c.id) || [],
        captainId: c.owner_id,
      });
      const nights: Night[] = (results[0].data || []).map((n) => ({
        id: n.id,
        name: n.name,
        date: n.play_date,
        time: n.start_time.slice(0, 5),
        tournaments: n.tournaments,
        clubs: regs
          .filter((r) => r.night_id === n.id)
          .map((r) => {
            const c = clubs.find((c) => c.id === r.club_id);
            if (!c) throw new Error("No se pudo leer un club inscrito.");
            return {
              ...mapClub(c),
              registrationOrder: Number(r.registration_number),
              registeredAt: r.registered_at,
            };
          }),
      }));
      const own = clubs.find((c) => c.owner_id === session.user.id);
      setMyClub(own ? mapClub(own) : undefined);
      setData((d) => ({
        version: 1,
        nights,
        activeId: nights.some((n) => n.id === d.activeId)
          ? d.activeId
          : nights.find((n) => !n.tournaments.length)?.id ||
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
    const { error } = await supabase.rpc(name, args);
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
  }
  const active = data.nights.find((n) => n.id === data.activeId);
  function current() {
    if (!active) throw new Error("Selecciona una noche.");
    return active.id;
  }
  const value: Context = {
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
        throw new Error("Noche no encontrada.");
      setData((d) => ({ ...d, activeId: id }));
    },
    createNight: (name, date, time) =>
      rpc("create_night", { p_name: name.trim(), p_date: date, p_time: time }),
    addClub: (name, contacts) =>
      rpc("admin_register_club", {
        p_night_id: current(),
        p_name: name.trim(),
        p_contacts: contacts.map((c) => c.trim()).filter(Boolean),
      }),
    removeClub: (id) =>
      rpc("remove_registration", { p_night_id: current(), p_club_id: id }),
    confirmPlan: (plan) =>
      rpc("confirm_plan", { p_night_id: current(), p_plan: plan }),
    saveMyClub: (name, contacts) =>
      rpc("create_my_club", {
        p_name: name.trim(),
        p_contacts: contacts.map((c) => c.trim()).filter(Boolean),
      }),
    updateContacts: (contacts) =>
      rpc("update_my_contacts", {
        p_contacts: contacts.map((c) => c.trim()).filter(Boolean),
      }),
    registerMyClub: () => {
      if (!myClub) throw new Error("Crea o vincula tu club primero.");
      return rpc("register_club", {
        p_night_id: current(),
        p_club_id: myClub.id,
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
