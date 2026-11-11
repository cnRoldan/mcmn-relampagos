export type Size = 4 | 6 | 8;
export type Club = {
  id: string;
  name: string;
  contacts: string[];
  registrationOrder?: number;
  registeredAt?: string;
  captainId?: string | null;
};
export type Tournament = { id: string; size: Size; clubIds: string[] };
export type Night = {
  id: string;
  name: string;
  date: string;
  time: string;
  clubs: Club[];
  tournaments: Tournament[];
  demo?: boolean;
};
export type Data = { version: 1; nights: Night[]; activeId: string | null };
export const emptyData: Data = { version: 1, nights: [], activeId: null };
export const format = (size: Size) =>
  size === 4
    ? "Liga + final"
    : size === 6
      ? "Liga sin final"
      : "Dos grupos + semifinales + final";
export function roundRobin(ids: string[]): [string, string][][] {
  if (![4, 6].includes(ids.length) || new Set(ids).size !== ids.length)
    throw new Error("La liga requiere 4 o 6 clubes distintos.");
  const a = [...ids],
    rounds: [string, string][][] = [];
  for (let r = 0; r < a.length - 1; r++) {
    const matches: [string, string][] = [];
    for (let i = 0; i < a.length / 2; i++)
      matches.push(
        r % 2 ? [a[a.length - 1 - i], a[i]] : [a[i], a[a.length - 1 - i]],
      );
    rounds.push(matches);
    a.splice(1, 0, a.pop()!);
  }
  return rounds;
}
export function validateClub(night: Night, name: string, contacts: string[]) {
  if (night.tournaments.length)
    throw new Error(
      "La inscripción está cerrada: el reparto ya está confirmado.",
    );
  if (!name.trim() || name.trim().length > 50)
    throw new Error("Escribe un nombre de club de hasta 50 caracteres.");
  if (
    night.clubs.some(
      (c) =>
        c.name
          .trim()
          .localeCompare(name.trim(), "es", { sensitivity: "base" }) === 0,
    )
  )
    throw new Error("Este club ya está inscrito en la noche.");
  if (contacts.length > 3 || contacts.some((c) => c.length > 24))
    throw new Error("Se permiten hasta tres contactos de 24 caracteres.");
}
export function validatePlan(night: Night, plan: Tournament[]) {
  if (night.tournaments.length)
    throw new Error("La noche ya tiene un reparto confirmado.");
  if (
    !plan.length ||
    plan.some((t) => ![4, 6, 8].includes(t.size) || t.clubIds.length !== t.size)
  )
    throw new Error("Completa las plazas de todos los relámpagos.");
  const ids = plan.flatMap((t) => t.clubIds);
  if (
    ids.length !== night.clubs.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !night.clubs.some((c) => c.id === id))
  )
    throw new Error(
      "Cada club debe aparecer exactamente una vez en el reparto.",
    );
}
export function parseData(raw: string): Data {
  const d: unknown = JSON.parse(raw);
  if (
    !d ||
    typeof d !== "object" ||
    !("version" in d) ||
    d.version !== 1 ||
    !("nights" in d) ||
    !Array.isArray(d.nights) ||
    !("activeId" in d) ||
    !(d.activeId === null || typeof d.activeId === "string")
  )
    throw new Error("Datos locales incompatibles.");
  const str = (v: unknown): v is string => typeof v === "string";
  const nights = d.nights as Night[];
  for (const n of nights) {
    if (
      !n ||
      !str(n.id) ||
      !str(n.name) ||
      !str(n.date) ||
      !str(n.time) ||
      !Array.isArray(n.clubs) ||
      !Array.isArray(n.tournaments)
    )
      throw new Error("Noche local no válida.");
    if (
      n.clubs.some(
        (c) =>
          !c ||
          !str(c.id) ||
          !str(c.name) ||
          !Array.isArray(c.contacts) ||
          c.contacts.length > 3 ||
          !c.contacts.every(str),
      )
    )
      throw new Error("Club local no válido.");
    if (new Set(n.clubs.map((c) => c.id)).size !== n.clubs.length)
      throw new Error("Clubes duplicados.");
    if (n.tournaments.length)
      validatePlan({ ...n, tournaments: [] }, n.tournaments);
  }
  if (
    new Set(nights.map((n) => n.id)).size !== nights.length ||
    (d.activeId !== null && !nights.some((n) => n.id === d.activeId))
  )
    throw new Error("Selección local no válida.");
  return d as Data;
}
