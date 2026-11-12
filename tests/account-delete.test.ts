import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAccountDeletion } from "../supabase/functions/account-delete/handler.ts";
import type { DeletionServices } from "../supabase/functions/account-delete/handler.ts";
function fixture() {
  const calls: string[] = [];
  const services: DeletionServices = {
    verifyAccess: async (token) => {
      calls.push(`access:${token}`);
      return { id: "own", email: "own@mcm.invalid" };
    },
    allowAttempt: async (id) => {
      calls.push(`quota:${id}`);
      return true;
    },
    verifyPassword: async (email, password) => {
      calls.push(`password:${email}`);
      return password === "correct"
        ? { id: "own", accessToken: "fresh-verified-token" }
        : null;
    },
    prepare: async (id) => {
      calls.push(`prepare:${id}`);
    },
    revoke: async (token) => {
      calls.push(`revoke:${token}`);
    },
    remove: async (id) => {
      calls.push(`remove:${id}`);
    },
  };
  const req = (body: unknown = { password: "correct" }, token = "own-token") =>
    new Request("https://example.invalid/delete", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    });
  return { services, calls, req };
}
test("Cuenta: exige sesión y contraseña correcta antes de borrar o revocar", async () => {
  const f = fixture();
  assert.equal(
    (
      await handleAccountDeletion(
        f.req({ password: "correct" }, ""),
        f.services,
      )
    ).status,
    401,
  );
  assert.equal(f.calls.length, 0);
  assert.equal(
    (await handleAccountDeletion(f.req({ password: "wrong" }), f.services))
      .status,
    401,
  );
  assert(!f.calls.some((c) => /prepare|remove|revoke/.test(c)));
  f.services.verifyAccess = async () => null;
  assert.equal((await handleAccountDeletion(f.req(), f.services)).status, 401);
});
test("Cuenta: ignora identidades del cuerpo y prepara, revoca y elimina solo la sesión verificada", async () => {
  const f = fixture();
  const response = await handleAccountDeletion(
    f.req({
      password: "correct",
      user_id: "victim",
      email: "victim@mcm.invalid",
    }),
    f.services,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(f.calls, [
    "access:own-token",
    "quota:own",
    "password:own@mcm.invalid",
    "prepare:own",
    "revoke:fresh-verified-token",
    "remove:own",
  ]);
});
test("Cuenta: límites y fallos parciales no se anuncian como eliminación terminada", async () => {
  const f = fixture();
  f.services.allowAttempt = async () => false;
  assert.equal((await handleAccountDeletion(f.req(), f.services)).status, 429);
  assert(!f.calls.some((c) => c.startsWith("prepare")));
  const broken = fixture();
  broken.services.remove = async () => {
    throw new Error("provider unavailable");
  };
  const response = await handleAccountDeletion(broken.req(), broken.services);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.pending, true);
  assert(!("deleted" in body));
  assert(!JSON.stringify(body).includes("provider unavailable"));
  const before = fixture();
  before.services.prepare = async () => {
    throw new Error("failed");
  };
  const early = await handleAccountDeletion(before.req(), before.services);
  assert.equal(early.status, 503);
  assert.equal((await early.json()).pending, false);
  assert(
    !before.calls.some((c) => c.startsWith("remove") || c.startsWith("revoke")),
  );
});
test("Cuenta: rechaza credenciales que resuelvan a otra identidad y peticiones inválidas", async () => {
  const f = fixture();
  f.services.verifyPassword = async () => ({
    id: "other",
    accessToken: "other-token",
  });
  assert.equal((await handleAccountDeletion(f.req(), f.services)).status, 401);
  assert(!f.calls.some((c) => c.startsWith("prepare")));
  assert.equal(
    (
      await handleAccountDeletion(
        new Request("https://example.invalid", { method: "GET" }),
        f.services,
      )
    ).status,
    405,
  );
  assert.equal(
    (await handleAccountDeletion(f.req({ password: "" }), f.services)).status,
    400,
  );
});

test("Cuenta: si falla la limpieza de escudos, queda pendiente y no borra Auth", async () => {
  const f = fixture();
  f.services.purgeFiles = async () => {
    throw new Error("storage unavailable");
  };
  const response = await handleAccountDeletion(f.req(), f.services);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).pending, true);
  assert(
    !f.calls.some((c) => c.startsWith("remove:") || c.startsWith("revoke:")),
  );
});
