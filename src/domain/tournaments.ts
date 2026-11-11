export type Size = 4 | 6 | 8;
export type Club = {
  id: string;
  name: string;
  contacts: string[];
  registrationOrder?: number;
  registeredAt?: string;
  captainId?: string | null;
};
export type CompetitionFormat = "copa" | "liga";
export type Tournament = {
  id: string;
  size: Size;
  clubIds: string[];
  format?: CompetitionFormat;
};
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
/** Missing format is the already-published legacy format; never reinterpret it. */
export const defaultFormat = (size: Size): CompetitionFormat =>
  size === 6 ? "liga" : "copa";
export const supportedFormats = (size: Size): CompetitionFormat[] =>
  size === 4 ? ["copa", "liga"] : size === 6 ? ["liga"] : ["copa"];
export const format = (
  size: Size,
  kind: CompetitionFormat = defaultFormat(size),
) =>
  kind === "liga"
    ? "Liga · Todos contra todos"
    : size === 4
      ? "Copa · Grupo único y final"
      : "Copa · Dos grupos, semifinales y final";
export function maxMatches(
  size: Size,
  kind: CompetitionFormat = defaultFormat(size),
) {
  if (!supportedFormats(size).includes(kind))
    throw new Error(
      "Ese formato no está disponible para este número de equipos con el límite de cinco partidos.",
    );
  return kind === "liga" ? size - 1 : size === 4 ? 4 : 5;
}
/** Minimum number of complete tournaments; larger groups break equal ties. */
export function suggestSplit(count: number): Size[] | null {
  if (!Number.isSafeInteger(count) || count < 4 || count % 2 !== 0) return null;
  const plans: (Size[] | null)[] = Array(count + 1).fill(null);
  plans[0] = [];
  for (let n = 1; n <= count; n++)
    for (const size of [8, 6, 4] as Size[]) {
      const before = plans[n - size];
      if (
        n >= size &&
        before &&
        (!plans[n] || before.length + 1 < plans[n]!.length)
      )
        plans[n] = [size, ...before];
    }
  return plans[count];
}
export type CompetitionPhase = {
  title: string;
  rounds: { label: string; matches: [string, string][] }[];
};
export function competitionPhases(t: Tournament): CompetitionPhase[] {
  const kind = t.format ?? defaultFormat(t.size);
  maxMatches(t.size, kind);
  const phase = (title: string, ids: string[]): CompetitionPhase => ({
    title,
    rounds: roundRobin(ids).map((matches, i) => ({
      label: `Jornada ${i + 1}`,
      matches,
    })),
  });
  if (kind === "liga") return [phase("Fase de liga", t.clubIds)];
  if (t.size === 4)
    return [
      phase("Grupo único", t.clubIds),
      {
        title: "Final",
        rounds: [
          { label: "Final", matches: [["1.º del grupo", "2.º del grupo"]] },
        ],
      },
    ];
  return [
    phase("Grupo A", t.clubIds.slice(0, 4)),
    phase("Grupo B", t.clubIds.slice(4)),
    {
      title: "Semifinales",
      rounds: [
        {
          label: "Semifinales cruzadas",
          matches: [
            ["1.º Grupo A", "2.º Grupo B"],
            ["1.º Grupo B", "2.º Grupo A"],
          ],
        },
      ],
    },
    {
      title: "Final",
      rounds: [
        {
          label: "Final",
          matches: [["Ganador semifinal 1", "Ganador semifinal 2"]],
        },
      ],
    },
  ];
}
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
    plan.some(
      (t) =>
        !t ||
        ![4, 6, 8].includes(t.size) ||
        !Array.isArray(t.clubIds) ||
        t.clubIds.length !== t.size ||
        !supportedFormats(t.size).includes(t.format ?? defaultFormat(t.size)),
    )
  )
    throw new Error("Completa las plazas de todos los relámpagos.");
  if (
    plan.some((t) => typeof t.id !== "string" || !t.id.trim()) ||
    new Set(plan.map((t) => t.id)).size !== plan.length
  )
    throw new Error("Cada relámpago debe tener un identificador distinto.");
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
