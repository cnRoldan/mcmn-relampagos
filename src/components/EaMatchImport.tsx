import React, { useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "../state/AppState";
import type { Match } from "../domain/results";
import type { EaCandidate } from "../domain/ea";
import { Button, Field, Note, Sheet } from "./UI";
import { Check } from "./Check";
import { styles as s } from "../theme";
export function EaMatchImport({
  match,
  home,
  away,
}: {
  match: Match;
  home: string;
  away: string;
}) {
  const { findEaResults, importEaResult } = useApp();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [rows, setRows] = useState<EaCandidate[]>([]),
    [chosen, setChosen] = useState<EaCandidate | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [hp, setHp] = useState(""),
    [ap, setAp] = useState(""),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const shootout =
    chosen &&
    chosen.home_goals === chosen.away_goals &&
    ["semifinal", "final"].includes(match.phase);
  if (match.ea_match_id)
    return (
      <Text style={s.subtitle}>
        EA · Partido {match.ea_match_id} · Rojas {match.ea_home_red ?? "—"} /{" "}
        {match.ea_away_red ?? "—"}
      </Text>
    );
  return (
    <>
      <Button
        secondary
        label="Buscar resultado en EA"
        onPress={async () => {
          setOpen(true);
          setRows([]);
          setChosen(null);
          setConfirmed(false);
          setHp("");
          setAp("");
          setBusy(true);
          setError("");
          try {
            const result = await findEaResults(match.id);
            setRows(result.candidates);
            setNote(result.note);
          } catch (e) {
            setError(e instanceof Error ? e.message : "EA no está disponible.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {open && (
        <Sheet
          title="Resultado de EA para este cruce"
          onClose={() => !busy && setOpen(false)}
        >
          <Text style={s.heading}>
            {home} vs {away}
          </Text>
          <Note>
            {note ||
              "Se buscan solo amistosos entre estos dos clubes posteriores al inicio del torneo y a la validación de sus vínculos EA."}
          </Note>
          {busy && <Text style={s.subtitle}>Consultando…</Text>}
          {!busy && !rows.length && !error && (
            <Text style={s.subtitle}>
              No hay candidatos guardados para este cruce. Puedes repetir la
              búsqueda o registrar el marcador manualmente. No se han importado
              otros partidos.
            </Text>
          )}
          {rows.map((r) => (
            <View key={r.id} style={s.card}>
              <Text style={s.heading}>
                {r.home_goals}–{r.away_goals}
              </Text>
              <Text style={s.text}>
                {new Intl.DateTimeFormat("es-ES", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Madrid",
                }).format(new Date(r.played_at))}
              </Text>
              <Text style={s.subtitle}>
                EA {r.ea_match_id} · Rojas reportadas {r.home_red ?? "—"} /{" "}
                {r.away_red ?? "—"}
              </Text>
              <Button
                secondary={chosen?.id !== r.id}
                label={`${chosen?.id === r.id ? "●" : "○"} Partido EA ${r.ea_match_id}`}
                onPress={() => {
                  setChosen(r);
                  setConfirmed(false);
                  setHp("");
                  setAp("");
                }}
              />
            </View>
          ))}
          {chosen && (
            <>
              <Check
                label="Confirmo que este es el partido programado en MCMN"
                checked={confirmed}
                onChange={setConfirmed}
              />
              {shootout && (
                <>
                  <Note>
                    EA no confirma la tanda en estos datos. Indica el resultado
                    de los penaltis para resolver la eliminatoria.
                  </Note>
                  <Field
                    label={`Penaltis · ${home}`}
                    value={hp}
                    onChangeText={setHp}
                    numeric
                    maxLength={2}
                  />
                  <Field
                    label={`Penaltis · ${away}`}
                    value={ap}
                    onChangeText={setAp}
                    numeric
                    maxLength={2}
                  />
                </>
              )}
              <Button
                label={busy ? "Importando…" : "Confirmar e importar a MCMN"}
                disabled={
                  busy ||
                  !confirmed ||
                  (!!shootout &&
                    (!/^\d{1,2}$/.test(hp) ||
                      !/^\d{1,2}$/.test(ap) ||
                      hp === ap))
                }
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await importEaResult(
                      match,
                      chosen.id,
                      shootout ? Number(hp) : null,
                      shootout ? Number(ap) : null,
                    );
                    setOpen(false);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "No se pudo importar.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
        </Sheet>
      )}
    </>
  );
}
