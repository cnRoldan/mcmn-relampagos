const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SITE_ORIGIN = "https://mcm-torneos-relampago.netlify.app";
export function parseTournamentLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "relampagos:" &&
      parsed.origin !== SITE_ORIGIN &&
      !(parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    )
      return null;
    const path =
      parsed.protocol === "relampagos:"
        ? parsed.host + parsed.pathname
        : parsed.pathname.replace(/^\//, "");
    const match = path.match(/^torneo\/([^/]+)\/?$/);
    return match && UUID.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}
export function tournamentLink(id: string) {
  if (!UUID.test(id)) throw new Error("Identificador de torneo no válido.");
  return `${SITE_ORIGIN}/torneo/${id}`;
}
