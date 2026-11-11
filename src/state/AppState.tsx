import { C, Context } from "./context";
import { CloudProvider } from "./CloudProvider";
import { cloudConfigured } from "../cloud/client";
import React, { useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  Data,
  Night,
  Club,
  Tournament,
  emptyData,
  parseData,
  validateClub,
  validatePlan,
} from "../domain/tournaments";
const KEY = "@relampagos/mobile/v1";
function LocalProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(emptyData),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const ref = useRef(data),
    queue = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive) return;
        const d = raw ? parseData(raw) : emptyData;
        ref.current = d;
        setData(d);
      })
      .catch(() => {
        if (alive)
          setError(
            "No se han podido leer los datos guardados. Puedes borrar los datos de prueba en Ajustes.",
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  function update(fn: (d: Data) => Data, repair = false) {
    const p = queue.current.then(async () => {
      if (!ready) throw new Error("Espera a que se carguen los datos.");
      if (error && !repair) throw new Error(error);
      const next = fn(ref.current);
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      ref.current = next;
      setData(next);
      if (repair) setError("");
    });
    queue.current = p.catch(() => {});
    return p;
  }
  function changeNight(fn: (n: Night) => Night) {
    return update((d) => {
      const n = d.nights.find((n) => n.id === d.activeId);
      if (!n) throw new Error("Crea o selecciona una noche.");
      return { ...d, nights: d.nights.map((x) => (x.id === n.id ? fn(n) : x)) };
    });
  }
  const value: Context = {
    mode: "local",
    isAdmin: true,
    myClub: undefined,
    refresh: async () => {},
    saveMyClub: async () => {
      throw new Error("Conecta el servidor para vincular tu club.");
    },
    updateContacts: async () => {
      throw new Error("Conecta el servidor.");
    },
    registerMyClub: async () => {
      throw new Error("Conecta el servidor.");
    },
    assignCaptain: async () => {
      throw new Error("Conecta el servidor.");
    },
    data,
    night: data.nights.find((n) => n.id === data.activeId),
    ready,
    error,
    createNight: (name, date, time) =>
      update((d) => {
        if (!name.trim()) throw new Error("Escribe el nombre de la noche.");
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          isNaN(Date.parse(date + "T12:00:00")) ||
          new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
        )
          throw new Error("Usa una fecha válida: AAAA-MM-DD.");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
          throw new Error("Usa una hora válida: HH:MM.");
        const n: Night = {
          id: Crypto.randomUUID(),
          name: name.trim(),
          date,
          time,
          clubs: [],
          tournaments: [],
        };
        return { ...d, nights: [...d.nights, n], activeId: n.id };
      }),
    select: (id) =>
      update((d) => {
        if (!d.nights.some((n) => n.id === id))
          throw new Error("Noche no encontrada.");
        return { ...d, activeId: id };
      }),
    addClub: (name, contacts) =>
      changeNight((n) => {
        contacts = contacts.map((c) => c.trim()).filter(Boolean);
        validateClub(n, name, contacts);
        const c: Club = {
          id: Crypto.randomUUID(),
          name: name.trim(),
          contacts,
        };
        return { ...n, clubs: [...n.clubs, c] };
      }),
    removeClub: (id) =>
      changeNight((n) => {
        if (n.tournaments.length)
          throw new Error("El reparto está confirmado.");
        return { ...n, clubs: n.clubs.filter((c) => c.id !== id) };
      }),
    confirmPlan: (plan) =>
      changeNight((n) => {
        validatePlan(n, plan);
        return { ...n, tournaments: plan };
      }),
    loadDemo: () =>
      update((d) => {
        const n: Night = {
          id: Crypto.randomUUID(),
          name: "Viernes bajo los focos",
          date: "2026-11-13",
          time: "22:00",
          demo: true,
          clubs: [
            "Barrio Norte FC",
            "La Última Jugada",
            "Atlético Virtual",
            "Los del Viernes",
            "Furia Club",
            "Real Pixel",
            "Unión Pro",
            "Tercer Tiempo",
          ].map((name) => ({ id: Crypto.randomUUID(), name, contacts: [] })),
          tournaments: [],
        };
        return { ...d, nights: [...d.nights, n], activeId: n.id };
      }),
    reset: () => update(() => ({ ...emptyData, nights: [] }), true),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useApp() {
  const c = useContext(C);
  if (!c) throw new Error("Provider no disponible");
  return c;
}

export function Provider({ children }: { children: React.ReactNode }) {
  return cloudConfigured ? (
    <CloudProvider>{children}</CloudProvider>
  ) : (
    <LocalProvider>{children}</LocalProvider>
  );
}
