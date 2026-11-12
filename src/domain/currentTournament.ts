import type { Night } from "./tournaments";
export function tournamentState(
  n: Night,
): "En preparación" | "En curso" | "Finalizado" {
  return n.endedAt
    ? "Finalizado"
    : n.tournaments.length
      ? "En curso"
      : "En preparación";
}
/** Home reflects current competition, independently of the tournament being browsed. */
export function currentTournament(nights: Night[]): Night | undefined {
  const key = (n: Night) => n.effectiveStart || `${n.date}T${n.time}`;
  const active = nights.filter((n) => !n.endedAt);
  return (
    active
      .filter((n) => n.tournaments.length)
      .sort(
        (a, b) => key(b).localeCompare(key(a)) || a.id.localeCompare(b.id),
      )[0] ??
    active
      .filter((n) => !n.tournaments.length)
      .sort(
        (a, b) => key(a).localeCompare(key(b)) || a.id.localeCompare(b.id),
      )[0]
  );
}
