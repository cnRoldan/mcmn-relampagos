import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { cloudConfigured, supabase } from "./client";
export type Profile = {
  id: string;
  ea_id: string;
  role: "admin" | "captain";
  is_banned?: boolean;
  ban_reason?: string;
};
type Auth = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  error: string;
  signIn: (ea: string, password: string) => Promise<void>;
  signUp: (ea: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};
const C = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(cloudConfigured),
    [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError("No se pudo recuperar la sesión.");
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setError("No se pudo recuperar la sesión.");
          setLoading(false);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (alive) {
        setSession(s);
        setLoading(false);
      }
    });
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") supabase!.auth.startAutoRefresh();
      else supabase!.auth.stopAutoRefresh();
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  async function reloadProfile() {
    if (!supabase || !session) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id,ea_id,role,is_banned,ban_reason")
      .eq("id", session.user.id)
      .single();
    if (error) throw new Error("No se ha podido cargar tu perfil.");
    setProfile(data as Profile);
  }
  useEffect(() => {
    let alive = true;
    setProfile(null);
    setError("");
    async function load() {
      if (!supabase || !session) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,ea_id,role,is_banned,ban_reason")
          .eq("id", session.user.id)
          .single();
        if (alive) {
          if (error) setError("No se ha podido cargar tu perfil.");
          else {
            setProfile(data as Profile);
            setError("");
          }
        }
      } catch {
        if (alive) setError("No se ha podido cargar tu perfil.");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 20000);
    const focus = AppState.addEventListener("change", (s) => {
      if (s === "active") void load();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      focus.remove();
    };
  }, [session?.user.id]);
  async function authRequest(body: Record<string, string>) {
    if (!supabase)
      throw new Error(
        "El acceso estará disponible cuando se conecte el servidor.",
      );
    const { data, error } = await supabase.functions.invoke("ea-auth", {
      body,
    });
    if (error) {
      let text = "No se ha podido completar el acceso.";
      try {
        text = (await error.context.json()).error || text;
      } catch {}
      throw new Error(text);
    }
    return data;
  }
  const value: Auth = {
    configured: cloudConfigured,
    loading,
    session,
    profile: profile?.id === session?.user.id ? profile : null,
    error,
    reloadProfile,
    signIn: async (ea, password) => {
      const data = await authRequest({
        action: "login",
        ea_id: ea.trim(),
        password,
      });
      if (!data.session) throw new Error("ID de EA o contraseña incorrectos.");
      const { error } = await supabase!.auth.setSession(data.session);
      if (error) throw new Error("No se pudo guardar la sesión.");
    },
    signUp: async (ea, password) => {
      const data = await authRequest({
        action: "signup",
        ea_id: ea.trim(),
        password,
      });
      if (data.session) {
        const { error } = await supabase!.auth.setSession(data.session);
        if (error) throw new Error("No se pudo guardar la sesión.");
      }
      return (
        data.message ||
        "Cuenta creada. Ya puedes entrar con tu ID de EA y contraseña."
      );
    },
    signOut: async () => {
      const { error } = await supabase!.auth.signOut({ scope: "local" });
      if (error)
        throw new Error("No se pudo cerrar la sesión. Inténtalo otra vez.");
      setProfile(null);
      setSession(null);
    },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useAuth() {
  const c = useContext(C);
  if (!c) throw new Error("AuthProvider no disponible");
  return c;
}
