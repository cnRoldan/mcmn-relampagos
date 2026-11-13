import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "../state/AppState";
import type { Club } from "../domain/tournaments";
import type { EloEntry } from "../domain/ea";
import { phaseTitle } from "../domain/results";
import type { MatchPhase } from "../domain/results";
import { Button, Note } from "./UI";
import { styles as s, colors } from "../theme";
export function McmClubHistory({ club }: { club: Club }) {
  const { clubHistory, data } = useApp();
  const [rows, setRows] = useState<EloEntry[]>([]),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  const fingerprint = data.nights
    .flatMap((n) => n.matches || [])
    .filter((m) => m.home_id === club.id || m.away_id === club.id)
    .map((m) => `${m.id}:${m.version}:${m.ea_match_id}`)
    .join("|");
  const stats = club.mcmStats;
  async function load(offset = 0) {
    setBusy(true);
    setError("");
    try {
      const page = await clubHistory(club.id, offset);
      setRows((old) => (offset ? [...old, ...page] : page));
      setMore(page.length === 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [club.id, fingerprint, stats?.rating, stats?.gf, stats?.ga]);
  return (
    <View style={s.card}>
      <Text style={s.heading}>ELO e historial MCM</Text>
      <Text style={{ fontSize: 32, color: colors.primary, fontWeight: "900" }}>
        {Math.round(stats?.rating ?? 1000)} ELO
      </Text>
      <Text style={s.subtitle}>
        {stats?.played ?? 0} partidos · {stats?.won ?? 0} victorias ·{" "}
        {stats?.drawn ?? 0} empates · {stats?.lost ?? 0} derrotas
      </Text>
      <Text style={s.subtitle}>
        GF {stats?.gf ?? 0} · GC {stats?.ga ?? 0}
      </Text>
      <Note>
        Solo cuentan resultados confirmados de MCM. El ELO cambia según el
        resultado y la fuerza del rival; goles, tarjetas y títulos no añaden
        bonificaciones en esta versión.
      </Note>
      {!rows.length && !busy && !error && (
        <Text style={s.subtitle}>
          Todavía no hay resultados oficiales de tu club.
        </Text>
      )}
      {rows.map((r) => (
        <View
          key={r.match_id}
          style={{
            gap: 6,
            borderBottomWidth: 1,
            borderColor: colors.line,
            paddingVertical: 12,
          }}
        >
          <Text style={s.text}>
            {r.tournament_name} · {phaseTitle[r.phase as MatchPhase] || r.phase}
            {["league", "group", "group_a", "group_b"].includes(r.phase)
              ? ` · Jornada ${r.round_number}`
              : ""}
          </Text>
          <Text style={s.heading}>
            {r.my_goals}–{r.their_goals} vs {r.opponent_name}
          </Text>
          {r.my_penalties !== null && (
            <Text style={s.subtitle}>
              Penaltis {r.my_penalties}–{r.their_penalties}
            </Text>
          )}
          <Text style={s.subtitle}>
            {new Intl.DateTimeFormat("es-ES", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Europe/Madrid",
            }).format(new Date(r.played_at))}{" "}
            ·{" "}
            {r.ea_match_id
              ? "Verificado con EA"
              : "Confirmado por administración"}
          </Text>
          <Text style={s.text}>
            {r.delta >= 0 ? "+" : ""}
            {r.delta.toFixed(1)} ELO · {Math.round(r.rating_before)} →{" "}
            {Math.round(r.rating_after)}
          </Text>
          {r.ea_match_id && (
            <Text style={s.subtitle}>
              Rojas reportadas:{" "}
              {r.red_cards === null ? "sin dato" : r.red_cards} · Amarillas: sin
              verificar
            </Text>
          )}
        </View>
      ))}
      {!!error && <Text style={s.error}>{error}</Text>}
      <Button
        secondary
        label={
          busy
            ? "Cargando…"
            : more
              ? "Cargar más partidos"
              : "Actualizar historial"
        }
        disabled={busy}
        onPress={() => void load(more ? rows.length : 0)}
      />
    </View>
  );
}
