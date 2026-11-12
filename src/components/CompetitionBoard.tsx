import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { Night, Tournament } from "../domain/tournaments";
import {
  competitionGroups,
  standings,
  phaseTitle,
  groupComplete,
  compareStanding,
  validateQualifiers,
  validateScore,
  matchWinner,
} from "../domain/results";
import type { Match, Standing } from "../domain/results";
import { useApp } from "../state/AppState";
import { ClubBadge } from "./ClubBadge";
import { Button, Badge, Field, Note, Sheet, Confirm } from "./UI";
import { colors, styles as s } from "../theme";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo guardar.";
function StandingsTable({
  rows,
  name,
  badge,
}: {
  rows: Standing[];
  name: (id: string) => string;
  badge: (id: string) => string | null | undefined;
}) {
  const stat = {
    width: 27,
    textAlign: "right" as const,
    fontSize: 12,
    color: colors.ink,
  };
  return (
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ minWidth: 280, flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ width: 22, fontSize: 12, color: colors.muted }}>
            #
          </Text>
          <Text style={{ flex: 1, fontSize: 12, color: colors.muted }}>
            Equipo
          </Text>
          {["PJ", "Pts", "GF", "GC", "DG"].map((v) => (
            <Text key={v} style={[stat, { fontWeight: "800" }]}>
              {v}
            </Text>
          ))}
        </View>
        {rows.map((row, i) => {
          const position =
            rows.filter((r) => compareStanding(r, row) < 0).length + 1;
          const tied = rows.some(
            (r) => r.clubId !== row.clubId && compareStanding(r, row) === 0,
          );
          return (
            <View
              key={row.clubId}
              accessible
              accessibilityLabel={`${name(row.clubId)}: ${row.points} puntos, ${row.played} jugados, ${row.gf} goles a favor, ${row.ga} en contra, diferencia ${row.gd}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text style={{ width: 22, fontSize: 11, color: colors.muted }}>
                {position}
                {tied ? "=" : ""}
              </Text>
              <View
                style={{
                  flex: 1,
                  minWidth: 90,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingRight: 4,
                }}
              >
                <ClubBadge
                  uri={badge(row.clubId)}
                  name={name(row.clubId)}
                  size={20}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.ink,
                  }}
                >
                  {name(row.clubId)}
                </Text>
              </View>
              <Text style={stat}>{row.played}</Text>
              <Text
                style={[stat, { fontWeight: "900", color: colors.primary }]}
              >
                {row.points}
              </Text>
              <Text style={stat}>{row.gf}</Text>
              <Text style={stat}>{row.ga}</Text>
              <Text style={stat}>
                {row.gd > 0 ? "+" : ""}
                {row.gd}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
export function CompetitionBoard({
  night: n,
  tournament: t,
  manage = false,
}: {
  night: Night;
  tournament: Tournament;
  manage?: boolean;
}) {
  const { isAdmin, mode, saveResult, startPlayoffs, resetPlayoffs } = useApp();
  const matches = (n.matches || []).filter((m) => m.competition_id === t.id);
  const groups = competitionGroups(t);
  const knockout = matches.filter(
    (m) => m.phase === "semifinal" || m.phase === "final",
  );
  const hasPlayoffs = knockout.length > 0,
    cup = groups[0].phase !== "league";
  const complete = groups.every((g) =>
    groupComplete(
      g.ids,
      matches.filter((m) => m.phase === g.phase),
    ),
  );
  const editable = manage && isAdmin && mode === "cloud" && !n.endedAt;
  const name = (id: string) => n.clubs.find((c) => c.id === id)?.name || id;
  const [editing, setEditing] = useState<Match | null>(null),
    [home, setHome] = useState(""),
    [away, setAway] = useState(""),
    [hp, setHp] = useState(""),
    [ap, setAp] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [qualifying, setQualifying] = useState(false),
    [picks, setPicks] = useState<Record<string, string[]>>({});
  const isShootout =
    !!editing &&
    (editing.phase === "semifinal" || editing.phase === "final") &&
    /^\d{1,2}$/.test(home) &&
    /^\d{1,2}$/.test(away) &&
    Number(home) === Number(away);
  function edit(m: Match) {
    setError("");
    setEditing(m);
    setHome(m.home_goals === null ? "" : String(m.home_goals));
    setAway(m.away_goals === null ? "" : String(m.away_goals));
    setHp(m.home_penalties === null ? "" : String(m.home_penalties));
    setAp(m.away_penalties === null ? "" : String(m.away_penalties));
  }
  async function save(clear = false) {
    if (!editing) return;
    setError("");
    setBusy(true);
    try {
      const parse = (v: string) =>
        v === "" ? null : /^\d{1,2}$/.test(v) ? Number(v) : NaN;
      const score = clear
        ? { home: null, away: null }
        : {
            home: parse(home),
            away: parse(away),
            homePenalties: isShootout ? parse(hp) : null,
            awayPenalties: isShootout ? parse(ap) : null,
          };
      validateScore(editing, score);
      await saveResult(editing, score);
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function renderMatch(m: Match) {
    const locked =
      (hasPlayoffs && !["semifinal", "final"].includes(m.phase)) ||
      (m.phase === "semifinal" && matches.some((x) => x.phase === "final"));
    const winner = matchWinner(m);
    return (
      <View
        key={m.id}
        style={{
          gap: 8,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        <View style={s.row}>
          <Text style={[s.text, { flex: 1, fontSize: 14 }]}>
            {name(m.home_id)}
          </Text>
          <Text
            style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}
          >
            {m.home_goals === null ? "—" : m.home_goals} :{" "}
            {m.away_goals === null ? "—" : m.away_goals}
          </Text>
          <Text style={[s.text, { flex: 1, textAlign: "right", fontSize: 14 }]}>
            {name(m.away_id)}
          </Text>
        </View>
        {m.home_penalties !== null && (
          <Text style={s.subtitle}>
            Penaltis: {m.home_penalties}–{m.away_penalties}
          </Text>
        )}
        {m.phase === "final" && winner && (
          <Badge>GANADOR · {name(winner)}</Badge>
        )}
        {editable && !locked && (
          <Button
            secondary
            label={
              m.home_goals === null ? "Cargar resultado" : "Editar resultado"
            }
            onPress={() => edit(m)}
          />
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: 18 }}>
      {groups.map((g) => {
        const groupMatches = matches.filter((m) => m.phase === g.phase);
        return (
          <View key={g.phase} style={s.card}>
            <Text accessibilityRole="header" style={s.heading}>
              {phaseTitle[g.phase]}
            </Text>
            <StandingsTable
              rows={standings(g.ids, groupMatches)}
              name={name}
              badge={(id) => n.clubs.find((c) => c.id === id)?.badgeUrl}
            />
            <Text style={[s.subtitle, { fontSize: 12 }]}>
              PJ: jugados · Pts: puntos · GF: goles a favor · GC: goles en
              contra · DG: diferencia.
            </Text>
            {manage &&
              [...new Set(groupMatches.map((m) => m.round_number))]
                .sort((a, b) => a - b)
                .map((r) => (
                  <View key={r} style={{ gap: 4 }}>
                    <Text style={s.eyebrow}>JORNADA {r}</Text>
                    {groupMatches
                      .filter((m) => m.round_number === r)
                      .sort((a, b) => a.match_number - b.match_number)
                      .map(renderMatch)}
                  </View>
                ))}
          </View>
        );
      })}
      <Text style={[s.subtitle, { fontSize: 12 }]}>
        Victoria: 3 puntos · Empate: 1 · Derrota: 0. Orden: puntos, DG y GF. «=»
        indica empate sin resolver.
      </Text>
      {cup && (
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.heading}>
            Playoffs
          </Text>
          {!hasPlayoffs && (
            <>
              <Note>
                {complete
                  ? "Grupos completados. La organización debe confirmar el orden de los dos primeros y generar los cruces."
                  : "Los dos primeros de cada grupo avanzarán al completar todos los resultados. Los cruces aún están pendientes."}
              </Note>
              {t.size === 8 ? (
                <>
                  <Text style={s.text}>
                    Semifinal 1 · 1.º Grupo A vs 2.º Grupo B
                  </Text>
                  <Text style={s.text}>
                    Semifinal 2 · 1.º Grupo B vs 2.º Grupo A
                  </Text>
                  <Text style={s.text}>
                    Final · Ganadores de las semifinales
                  </Text>
                </>
              ) : (
                <Text style={s.text}>
                  Final · 1.º del grupo vs 2.º del grupo
                </Text>
              )}
              {editable && complete && (
                <Button
                  label="Confirmar clasificados y generar playoffs"
                  onPress={() => {
                    setError("");
                    setPicks(
                      Object.fromEntries(
                        groups.map((g) => [
                          g.phase,
                          standings(
                            g.ids,
                            matches.filter((m) => m.phase === g.phase),
                          )
                            .slice(0, 2)
                            .map((r) => r.clubId),
                        ]),
                      ),
                    );
                    setQualifying(true);
                  }}
                />
              )}
            </>
          )}
          {hasPlayoffs && (
            <>
              {(["semifinal", "final"] as const).map((ph) => {
                const games = knockout
                  .filter((m) => m.phase === ph)
                  .sort((a, b) => a.match_number - b.match_number);
                return games.length ? (
                  <View key={ph} style={{ gap: 10 }}>
                    <Text style={s.eyebrow}>
                      {phaseTitle[ph].toUpperCase()}
                    </Text>
                    {games.map(renderMatch)}
                  </View>
                ) : ph === "final" ? (
                  <Text key={ph} style={s.subtitle}>
                    Final · Pendiente de los ganadores de semifinales.
                  </Text>
                ) : null;
              })}
              {editable && (
                <>
                  <Note>
                    Para corregir los grupos o una semifinal con final generada,
                    reinicia los playoffs.
                  </Note>
                  <Confirm
                    label="Reiniciar playoffs"
                    title="Reiniciar playoffs"
                    danger
                    message="Se borrarán los cruces y resultados de playoffs. Los resultados de grupos se conservarán para corregirlos y volver a generar los cruces."
                    onConfirm={() => resetPlayoffs(t.id)}
                  />
                </>
              )}
            </>
          )}
        </View>
      )}
      {editing && (
        <Sheet
          title="Resultado del partido"
          onClose={() => !busy && setEditing(null)}
        >
          <Text style={s.heading}>
            {name(editing.home_id)} vs {name(editing.away_id)}
          </Text>
          <Field
            label={`Goles · ${name(editing.home_id)}`}
            value={home}
            onChangeText={setHome}
            numeric
            maxLength={2}
          />
          <Field
            label={`Goles · ${name(editing.away_id)}`}
            value={away}
            onChangeText={setAway}
            numeric
            maxLength={2}
          />
          {isShootout && (
            <>
              <Note>
                Eliminatoria empatada: indica el resultado de la tanda de
                penaltis por separado.
              </Note>
              <Field
                label={`Penaltis · ${name(editing.home_id)}`}
                value={hp}
                onChangeText={setHp}
                numeric
                maxLength={2}
              />
              <Field
                label={`Penaltis · ${name(editing.away_id)}`}
                value={ap}
                onChangeText={setAp}
                numeric
                maxLength={2}
              />
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label={busy ? "Guardando…" : "Guardar resultado"}
            disabled={busy}
            onPress={() => void save()}
          />
          {editing.home_goals !== null && (
            <Button
              label="Dejar resultado pendiente"
              secondary
              disabled={busy}
              onPress={() => void save(true)}
            />
          )}
        </Sheet>
      )}
      {qualifying && (
        <Sheet
          title="Confirmar clasificados"
          onClose={() => !busy && setQualifying(false)}
        >
          <Note>
            Se respetan puntos, DG y GF. Solo puedes decidir el orden entre
            equipos empatados en esos tres criterios.
          </Note>
          {groups.map((g) => (
            <View key={g.phase} style={{ gap: 12 }}>
              <Text style={s.heading}>{phaseTitle[g.phase]}</Text>
              {[0, 1].map((index) => (
                <View key={index} style={{ gap: 6 }}>
                  <Text style={s.text}>{index + 1}.º clasificado</Text>
                  {standings(
                    g.ids,
                    matches.filter((m) => m.phase === g.phase),
                  ).map((row) => (
                    <Button
                      key={row.clubId}
                      secondary={picks[g.phase]?.[index] !== row.clubId}
                      label={`${picks[g.phase]?.[index] === row.clubId ? "● " : "○ "}${name(row.clubId)} · ${row.points} pts · DG ${row.gd} · GF ${row.gf}`}
                      onPress={() =>
                        setPicks((old) => ({
                          ...old,
                          [g.phase]: [0, 1].map((i) =>
                            i === index ? row.clubId : old[g.phase]?.[i] || "",
                          ),
                        }))
                      }
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label={busy ? "Generando…" : "Generar playoffs"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                for (const g of groups)
                  validateQualifiers(
                    standings(
                      g.ids,
                      matches.filter((m) => m.phase === g.phase),
                    ),
                    picks[g.phase] || [],
                  );
                await startPlayoffs(
                  t.id,
                  picks[groups[0].phase],
                  groups[1] ? picks[groups[1].phase] : [],
                );
                setQualifying(false);
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Sheet>
      )}
    </View>
  );
}
