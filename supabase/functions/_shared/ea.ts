export const EA_EDITION = "fc27";
export type EaPool = "common-gen5" | "nx";
export type EaCandidate = {
  ea_match_id: string;
  played_at: string;
  home_goals: number;
  away_goals: number;
  home_red: number | null;
  away_red: number | null;
  match_type: "friendlyMatch";
};
export function parseEaClub(value: string): { id: string; pool: EaPool } {
  const input = value.trim();
  if (/^\d{1,20}$/.test(input) && BigInt(input) > 0n)
    return { id: input.replace(/^0+/, ""), pool: "common-gen5" };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Introduce el ID del club EA o su enlace de Clubes.");
  }
  if (
    url.protocol !== "https:" ||
    !["www.ea.com", "ea.com"].includes(url.hostname) ||
    !url.pathname.includes("/clubs/")
  )
    throw new Error("Utiliza un enlace de Clubes de ea.com.");
  const id = url.searchParams.get("clubId"),
    pool = url.searchParams.get("platform");
  if (
    !id ||
    !/^[1-9]\d{0,19}$/.test(id) ||
    !["common-gen5", "nx"].includes(pool || "")
  )
    throw new Error("Revisa el ID y la plataforma del enlace de EA.");
  return { id, pool: pool as EaPool };
}
export function eaClubInfo(
  raw: unknown,
  id: string,
): { id: string; name: string } {
  const record = (raw as Record<string, any>)?.[id];
  if (
    !record ||
    String(record.clubId) !== id ||
    typeof record.name !== "string" ||
    !record.name.trim() ||
    record.name.length > 100
  )
    throw new Error("EA no devuelve un club válido para ese identificador.");
  return { id, name: record.name.trim() };
}
const nonnegative = (v: unknown, max = 99): number | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  if (!/^\d+$/.test(String(v))) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n <= max ? n : null;
};
export function eaCandidates(
  raw: unknown,
  home: string,
  away: string,
  start: string,
  now = Date.now(),
): EaCandidate[] {
  if (raw === null) return [];
  if (!Array.isArray(raw))
    throw new Error("EA ha cambiado el formato de los partidos.");
  const result: EaCandidate[] = [];
  const seen = new Set<string>();
  for (const m of raw) {
    if (
      !m ||
      !/^\d{1,30}$/.test(String(m.matchId)) ||
      seen.has(String(m.matchId))
    )
      continue;
    const ids = Object.keys(m.clubs || {});
    if (ids.length !== 2 || !ids.includes(home) || !ids.includes(away))
      continue;
    const h = m.clubs[home],
      a = m.clubs[away],
      hg = nonnegative(h.goals),
      ag = nonnegative(a.goals),
      epoch = nonnegative(m.timestamp, 9999999999);
    if (
      hg === null ||
      ag === null ||
      epoch === null ||
      epoch * 1000 < Date.parse(start) ||
      epoch * 1000 > now + 300000
    )
      continue;
    if (
      nonnegative(h.goalsAgainst) !== ag ||
      nonnegative(a.goalsAgainst) !== hg
    )
      continue;
    // EA's friendly result flags are commonly zero; derive the result from goals.
    // DNF and shootout semantics need an explicit policy, so DNF is manual for now.
    if (
      String(h.winnerByDnf) === "1" ||
      String(a.winnerByDnf) === "1" ||
      ["10", "16385"].includes(String(h.result)) ||
      ["10", "16385"].includes(String(a.result))
    )
      continue;
    const aggregate = m.aggregate || {};
    result.push({
      ea_match_id: String(m.matchId),
      played_at: new Date(epoch * 1000).toISOString(),
      home_goals: hg,
      away_goals: ag,
      home_red: nonnegative(aggregate[home]?.redcards, 30),
      away_red: nonnegative(aggregate[away]?.redcards, 30),
      match_type: "friendlyMatch",
    });
    seen.add(String(m.matchId));
  }
  return result.sort((a, b) => a.played_at.localeCompare(b.played_at));
}
export async function fetchEa(
  endpoint: "clubs/info" | "clubs/matches",
  params: Record<string, string>,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL("https://proclubs.ea.com/api/fc/" + endpoint);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      `EA no está disponible (HTTP ${response.status}). No se ha importado ningún resultado.`,
    );
  const text = await response.text();
  if (text.length > 2500000)
    throw new Error("La respuesta de EA es demasiado grande.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("EA no ha devuelto JSON válido.");
  }
}
