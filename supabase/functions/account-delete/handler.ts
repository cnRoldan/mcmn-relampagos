export type DeletionServices = {
  verifyAccess: (
    token: string,
  ) => Promise<{ id: string; email: string } | null>;
  allowAttempt: (id: string) => Promise<boolean>;
  verifyPassword: (
    email: string,
    password: string,
  ) => Promise<{ id: string; accessToken: string } | null>;
  prepare: (id: string) => Promise<void>;
  purgeFiles?: (id: string) => Promise<void>;
  revoke: (token: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
export async function handleAccountDeletion(
  req: Request,
  services: DeletionServices,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return reply({ error: "Método no permitido." }, 405);
  const token = /^Bearer (.+)$/i.exec(
    req.headers.get("authorization") || "",
  )?.[1];
  if (!token)
    return reply({ error: "Inicia sesión para eliminar tu cuenta." }, 401);
  let prepared = false;
  try {
    if (Number(req.headers.get("content-length") || 0) > 2048)
      return reply({ error: "Solicitud demasiado grande." }, 413);
    const raw = await req.text();
    if (raw.length > 2048)
      return reply({ error: "Solicitud demasiado grande." }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "Solicitud no válida." }, 400);
    }
    if (
      !body ||
      typeof body.password !== "string" ||
      !body.password.length ||
      body.password.length > 128
    )
      return reply({ error: "Introduce tu contraseña actual." }, 400);
    const user = await services.verifyAccess(token);
    if (!user)
      return reply(
        { error: "La sesión ya no es válida. Vuelve a entrar." },
        401,
      );
    if (!(await services.allowAttempt(user.id)))
      return reply({ error: "Demasiados intentos. Espera diez minutos." }, 429);
    const verified = await services.verifyPassword(user.email, body.password);
    if (!verified || verified.id !== user.id)
      return reply({ error: "La contraseña actual no es correcta." }, 401);
    // Never accept a target user ID or an email from the body.
    await services.prepare(user.id);
    prepared = true;
    await services.purgeFiles?.(user.id);
    await services.revoke(verified.accessToken);
    await services.remove(user.id);
    return reply({ deleted: true });
  } catch {
    return reply(
      {
        error: prepared
          ? "La cuenta ha quedado bloqueada para completar su eliminación. Reintenta desde esta pantalla con tu contraseña."
          : "No se pudo eliminar la cuenta. Inténtalo de nuevo.",
        pending: prepared,
      },
      503,
    );
  }
}
