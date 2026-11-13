import { defaultFormat, roundRobin } from "./tournaments.ts";
import type { Tournament } from "./tournaments.ts";
export type MatchPhase =
  | "league"
  | "group"
  | "group_a"
  | "group_b"
  | "semifinal"
  | "final";
export type Match = {
  id: string;
  night_id: string;
  competition_id: string;
  phase: MatchPhase;
  round_number: number;
  match_number: number;
  home_id: string;
  away_id: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  version: number;
  ea_match_id?: string | null;
  ea_played_at?: string | null;
  ea_home_red?: number | null;
  ea_away_red?: number | null;
};
export type Score = {
  home: number | null;
  away: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
};
export type Standing = {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};
export const phaseTitle: Record<MatchPhase, string> = {
  league: "Clasificación",
  group: "Grupo único",
  group_a: "Grupo A",
  group_b: "Grupo B",
  semifinal: "Semifinales",
  final: "Final",
};
export function competitionGroups(
  t: Tournament,
): { phase: MatchPhase; ids: string[] }[] {
  if ((t.format ?? defaultFormat(t.size)) === "liga")
    return [{ phase: "league", ids: t.clubIds }];
  return t.size === 4
    ? [{ phase: "group", ids: t.clubIds }]
    : [
        { phase: "group_a", ids: t.clubIds.slice(0, 4) },
        { phase: "group_b", ids: t.clubIds.slice(4, 8) },
      ];
}
export function initialMatches(
  nightId: string,
  t: Tournament,
  uuid: () => string,
): Match[] {
  return competitionGroups(t).flatMap((g) =>
    roundRobin(g.ids).flatMap((round, r) =>
      round.map(([home, away], m) => ({
        id: uuid(),
        night_id: nightId,
        competition_id: t.id,
        phase: g.phase,
        round_number: r + 1,
        match_number: m + 1,
        home_id: home,
        away_id: away,
        home_goals: null,
        away_goals: null,
        home_penalties: null,
        away_penalties: null,
        version: 0,
      })),
    ),
  );
}
export function standings(ids: string[], matches: Match[]): Standing[] {
  const table = new Map(
    ids.map((clubId) => [
      clubId,
      {
        clubId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      },
    ]),
  );
  for (const m of matches) {
    if (
      m.home_goals === null ||
      m.away_goals === null ||
      m.phase === "semifinal" ||
      m.phase === "final"
    )
      continue;
    const home = table.get(m.home_id),
      away = table.get(m.away_id);
    if (!home || !away) continue;
    for (const [row, gf, ga] of [
      [home, m.home_goals, m.away_goals],
      [away, m.away_goals, m.home_goals],
    ] as [Standing, number, number][]) {
      row.played++;
      row.gf += gf;
      row.ga += ga;
      row.gd = row.gf - row.ga;
      if (gf > ga) {
        row.won++;
        row.points += 3;
      } else if (gf === ga) {
        row.drawn++;
        row.points++;
      } else row.lost++;
    }
  }
  // Stable seed order is display-only; equal sporting criteria need an admin decision for playoffs.
  return [...table.values()].sort(compareStanding);
}
export function compareStanding(a: Standing, b: Standing) {
  return b.points - a.points || b.gd - a.gd || b.gf - a.gf;
}
export function groupComplete(ids: string[], matches: Match[]) {
  return (
    matches.length === (ids.length * (ids.length - 1)) / 2 &&
    matches.every((m) => m.home_goals !== null && m.away_goals !== null)
  );
}
export function validateQualifiers(table: Standing[], ids: string[]) {
  if (
    ids.length !== 2 ||
    new Set(ids).size !== 2 ||
    ids.some((id) => !table.some((r) => r.clubId === id))
  )
    throw new Error("Elige dos clubes distintos de cada grupo.");
  for (let i = 0; i < 2; i++) {
    const selected = table.find((r) => r.clubId === ids[i])!;
    if (
      table.some(
        (r) =>
          !ids.slice(0, i + 1).includes(r.clubId) &&
          compareStanding(r, selected) < 0,
      )
    )
      throw new Error(
        "Respeta puntos, diferencia de goles y goles a favor. Solo puedes decidir entre clubes empatados.",
      );
  }
}
export function matchWinner(m: Match): string | null {
  if (m.home_goals === null || m.away_goals === null) return null;
  if (m.home_goals !== m.away_goals)
    return m.home_goals > m.away_goals ? m.home_id : m.away_id;
  return m.home_penalties !== null &&
    m.away_penalties !== null &&
    m.home_penalties !== m.away_penalties
    ? m.home_penalties > m.away_penalties
      ? m.home_id
      : m.away_id
    : null;
}
export function validateScore(m: Match, score: Score) {
  const values = [score.home, score.away],
    penalties = [score.homePenalties ?? null, score.awayPenalties ?? null];
  const valid = (n: number | null): n is number =>
    n !== null && Number.isInteger(n) && n >= 0 && n <= 99;
  if (values.every((n) => n === null) && penalties.every((n) => n === null))
    return;
  if (!values.every(valid))
    throw new Error("Introduce los dos marcadores, entre 0 y 99.");
  const knockout = m.phase === "semifinal" || m.phase === "final";
  if (knockout && score.home === score.away) {
    if (!penalties.every(valid) || penalties[0] === penalties[1])
      throw new Error("Indica una tanda de penaltis con un ganador.");
  } else if (penalties.some((n) => n !== null))
    throw new Error("Los penaltis solo se usan en eliminatorias empatadas.");
}
