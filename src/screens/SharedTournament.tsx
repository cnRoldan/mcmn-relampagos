import React, { useEffect, useState } from "react";
import { Text, View, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../cloud/client";
import { BrandLogo } from "../components/BrandLogo";
import { Button, Note, Page } from "../components/UI";
import { styles as s } from "../theme";
export type PublicTournament = {
  id: string;
  name: string;
  play_date: string;
  start_time: string;
  rules: string;
  status: "open" | "closed" | "finished";
  grace_minutes: number;
  effective_start: string;
  registered_count: number;
};
export function tournamentTime(start: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(start));
}
export function SharedTournament({
  id,
  onAccess,
}: {
  id: string;
  onAccess: () => void;
}) {
  const [info, setInfo] = useState<PublicTournament | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setInfo(null);
    setError("");
    async function load() {
      if (!supabase) {
        if (alive) {
          setError("El servidor no está configurado.");
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase.rpc("get_public_tournament", {
          p_tournament_id: id,
        });
        if (!alive) return;
        if (error)
          setError("No se ha podido cargar el torneo. Inténtalo de nuevo.");
        else if (!data?.length)
          setError("Este enlace no corresponde a un torneo disponible.");
        else {
          setInfo(data[0] as PublicTournament);
          setError("");
        }
        setLoading(false);
      } catch {
        if (alive) {
          setError("No se ha podido conectar con el torneo.");
          setLoading(false);
        }
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
  }, [id]);
  return (
    <SafeAreaView style={s.page}>
      <Page
        title={info?.name || "Torneo relámpago"}
        subtitle="MCM · Inscripción de clubes"
      >
        <BrandLogo />
        {loading && <Text style={s.subtitle}>Cargando torneo…</Text>}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {info && (
          <>
            <View style={s.card}>
              <Text style={s.heading}>
                Inicio · {tournamentTime(info.effective_start)}
              </Text>
              <Text style={s.subtitle}>
                Hora de Madrid · {info.registered_count} clubes inscritos.
              </Text>
              {info.grace_minutes > 0 && (
                <Note>
                  La organización ha concedido {info.grace_minutes} minutos de
                  margen.
                </Note>
              )}
              <Note>
                {info.status === "open"
                  ? "Inscripción abierta. La organización confirmará los participantes y decidirá Copa o Liga."
                  : info.status === "finished"
                    ? "Este torneo ha finalizado."
                    : "Torneo en curso. Las inscripciones están cerradas."}
              </Note>
            </View>
            <View style={s.card}>
              <Text style={s.heading}>Normas del torneo</Text>
              <Text style={s.text}>
                {info.rules ||
                  "La organización todavía no ha publicado las normas."}
              </Text>
            </View>
            <Button
              label={
                info.status === "open"
                  ? "Inscribir a mi club"
                  : "Acceder a mi cuenta"
              }
              onPress={onAccess}
            />
            <Text style={s.subtitle}>
              Accede o crea tu cuenta de capitán. Solo se registra el club y su
              capitán; los jugadores no necesitan cuentas.
            </Text>
          </>
        )}
      </Page>
    </SafeAreaView>
  );
}
