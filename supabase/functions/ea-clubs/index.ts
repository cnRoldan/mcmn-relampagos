import { createClient } from "npm:@supabase/supabase-js@2";
import {
  EA_EDITION,
  parseEaClub,
  eaClubInfo,
  eaCandidates,
  fetchEa,
} from "../_shared/ea.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return reply({ error: "Método no permitido." }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 2048)
      return reply({ error: "Solicitud demasiado grande." }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "Solicitud no válida." }, 400);
    }
    if (!body || typeof body.action !== "string")
      return reply({ error: "Acción no válida." }, 400);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const { data, error } = await admin.rpc(name, args);
      if (error) {
        if (error.code === "23505")
          throw new Error("Ese club o partido EA ya está vinculado en MCM.");
        throw new Error(error.message);
      }
      return data;
    };
    const lookup = async (input: string) => {
      const { id, pool } = parseEaClub(input);
      const cached = await admin
        .from("ea_club_cache")
        .select("ea_name,fetched_at")
        .eq("platform", pool)
        .eq("ea_club_id", id)
        .maybeSingle();
      if (
        cached.data &&
        Date.now() - Date.parse(cached.data.fetched_at) < 600000
      )
        return {
          id,
          name: cached.data.ea_name,
          platform: pool,
          edition: EA_EDITION,
        };
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("ea-lookup:" + ip),
      );
      const key = Array.from(new Uint8Array(hash), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      if (!(await rpc("consume_auth_attempt", { p_key: key })))
        throw new Error("Demasiadas consultas a EA. Espera diez minutos.");
      const club = eaClubInfo(
        await fetchEa("clubs/info", { platform: pool, clubIds: id }),
        id,
      );
      const stored = await admin
        .from("ea_club_cache")
        .upsert({
          platform: pool,
          ea_club_id: id,
          ea_name: club.name,
          fetched_at: new Date().toISOString(),
        });
      if (stored.error)
        throw new Error("No se pudo guardar la consulta de EA.");
      return { ...club, platform: pool, edition: EA_EDITION };
    };
    // Public, cached EA metadata lookup only. It discloses no MCM ownership,
    // account data, credentials or match history; all writes below authenticate.
    if (body.action === "lookup") {
      if (typeof body.input !== "string")
        return reply({ error: "Introduce el enlace del club EA." }, 400);
      return reply({ club: await lookup(body.input) });
    }
    const token = /^Bearer (.+)$/i.exec(
      req.headers.get("authorization") || "",
    )?.[1];
    if (!token) return reply({ error: "Inicia sesión." }, 401);
    const { data: user, error } = await admin.auth.getUser(token);
    if (error || !user.user)
      return reply({ error: "Tu sesión no es válida." }, 401);
    const actor = user.user.id;
    if (body.action === "link") {
      if (typeof body.input !== "string")
        return reply({ error: "Introduce el enlace del club EA." }, 400);
      const club = await lookup(body.input);
      await rpc("set_ea_club_link", {
        p_actor: actor,
        p_club_id: body.club_id,
        p_ea_id: club.id,
        p_platform: club.platform,
        p_edition: club.edition,
        p_name: club.name,
      });
      return reply({ saved: true });
    }
    if (body.action === "unlink") {
      await rpc("set_ea_club_link", {
        p_actor: actor,
        p_club_id: body.club_id,
        p_ea_id: null,
        p_platform: null,
        p_edition: null,
        p_name: null,
      });
      return reply({ saved: true });
    }
    if (body.action === "verify") {
      await rpc("verify_ea_club_link", {
        p_actor: actor,
        p_club_id: body.club_id,
        p_version: body.version,
      });
      return reply({ saved: true });
    }
    if (body.action === "candidates") {
      const context = await rpc("ea_match_context", {
        p_actor: actor,
        p_match_id: body.match_id,
      });
      const rawMatches = await fetchEa("clubs/matches", {
        platform: context.platform,
        clubIds: context.home_ea_id,
        matchType: "friendlyMatch",
        maxResultCount: "10",
      });
      const rows = eaCandidates(
        rawMatches,
        context.home_ea_id,
        context.away_ea_id,
        context.start_at,
      );
      await rpc("cache_ea_match_candidates", {
        p_actor: actor,
        p_match_id: body.match_id,
        p_context: context,
        p_rows: rows,
      });
      const { data, error } = await admin
        .from("ea_match_candidates")
        .select(
          "id,mcm_match_id,ea_match_id,played_at,home_goals,away_goals,home_red,away_red,fetched_at",
        )
        .eq("mcm_match_id", body.match_id)
        .order("played_at");
      if (error) throw error;
      return reply({
        candidates: data,
        note: "Solo amistosos de estos dos clubes posteriores al inicio y a sus vínculos validados. EA conserva una ventana limitada. Revisa la fecha antes de confirmar. Los abandonos requieren revisión manual.",
      });
    }
    if (body.action === "import") {
      await rpc("import_ea_match", {
        p_actor: actor,
        p_candidate_id: body.candidate_id,
        p_version: body.version,
        p_hp: body.home_penalties ?? null,
        p_ap: body.away_penalties ?? null,
      });
      return reply({ saved: true });
    }
    return reply({ error: "Acción no válida." }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const safe =
      /^(EA |El |Los |La |Ese |Este |Solo |Tu |No |Falta |Datos |Introduce |Utiliza |Revisa |Demasiadas|Deja )/.test(
        message,
      )
        ? message
        : "No se pudo completar la consulta de EA. Inténtalo de nuevo.";
    return reply({ error: safe }, 503);
  }
});
