import { decodeBadge, inspectBadge } from "../_shared/badges.ts";
export type ClubServices = {
  verify: (token: string) => Promise<string | null>;
  acquire: (id: string, deleting: boolean) => Promise<string>;
  release: (id: string, operation: string) => Promise<void>;
  current: (
    id: string,
  ) => Promise<{ name: string; badge_path: string | null } | null>;
  upload: (path: string, bytes: Uint8Array, mime: string) => Promise<void>;
  discard: (path: string) => Promise<void>;
  purge: (id: string, keep: string | null) => Promise<void>;
  save: (
    id: string,
    operation: string,
    name: string,
    contacts: string[],
    badge: string | null,
    version: number | null,
  ) => Promise<void>;
  remove: (
    id: string,
    operation: string,
    confirmation: string,
  ) => Promise<void>;
  uuid: () => string;
};
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
export async function handleClubProfile(req: Request, services: ClubServices) {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return reply({ error: "Método no permitido." }, 405);
  const token = /^Bearer (.+)$/i.exec(
    req.headers.get("authorization") || "",
  )?.[1];
  if (!token) return reply({ error: "Inicia sesión." }, 401);
  let owner: string | null = null,
    operation: string | null = null,
    uploaded: string | null = null,
    saved = false,
    deleting = false;
  try {
    const raw = await req.text();
    if (raw.length > 2850000)
      return reply({ error: "La imagen supera el tamaño permitido." }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "Solicitud no válida." }, 400);
    }
    if (!body || !["save", "delete"].includes(body.action))
      return reply({ error: "Acción no válida." }, 400);
    deleting = body.action === "delete";
    owner = await services.verify(token);
    if (!owner)
      return reply({ error: "Tu sesión no es válida. Vuelve a entrar." }, 401);
    let image: Uint8Array | null = null,
      format: { mime: string; extension: string } | null = null;
    if (body.action === "save") {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 50 ||
        !Array.isArray(body.contacts) ||
        body.contacts.length < 1 ||
        body.contacts.length > 3 ||
        body.contacts.some(
          (p: unknown) => typeof p !== "string" || !/^\+[1-9]\d{7,14}$/.test(p),
        )
      )
        return reply(
          {
            error:
              "Revisa el nombre y los teléfonos con prefijo internacional.",
          },
          400,
        );
      if (
        body.version !== null &&
        (!Number.isInteger(body.version) || body.version < 0)
      )
        return reply({ error: "Actualiza el club antes de guardarlo." }, 400);
      if (body.badge !== undefined && body.badge !== null) {
        image = decodeBadge(body.badge.base64);
        format = inspectBadge(image);
      }
    }
    operation = await services.acquire(owner, body.action === "delete");
    const current = await services.current(owner);
    if (body.action === "delete") {
      if (!current || body.confirmation !== current.name)
        return reply(
          { error: "Escribe el nombre exacto de tu club para confirmar." },
          400,
        );
      await services.purge(owner, null);
      await services.remove(owner, operation, body.confirmation);
      return reply({ deleted: true });
    }
    let badge = current?.badge_path || null;
    if (image && format) {
      uploaded = `${owner}/${services.uuid()}.${format.extension}`;
      await services.upload(uploaded, image, format.mime);
      badge = uploaded;
    } else if (body.badge === null) badge = null;
    await services.save(
      owner,
      operation,
      body.name.trim(),
      body.contacts,
      badge,
      body.version,
    );
    saved = true;
    let cleanupPending = false;
    try {
      await services.purge(owner, badge);
    } catch {
      cleanupPending = true;
    }
    return reply({ saved: true, cleanupPending });
  } catch (e) {
    if (uploaded && !saved)
      try {
        await services.discard(uploaded);
      } catch {}
    const text = e instanceof Error ? e.message : "";
    const safe =
      /^(El escudo|El archivo|Elige una|Hay otra operación|Tu cuenta|El club ha cambiado|Ya tienes un club|No se pudo verificar)/.test(
        text,
      )
        ? text
        : deleting
          ? "No se pudo eliminar el club. Inténtalo de nuevo."
          : "No se pudo guardar el club. Revisa los datos e inténtalo de nuevo.";
    return reply({ error: safe }, 400);
  } finally {
    if (owner && operation)
      try {
        await services.release(owner, operation);
      } catch {}
  }
}
