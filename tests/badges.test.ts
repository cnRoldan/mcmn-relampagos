import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  decodeBadge,
  inspectBadge,
  MAX_BADGE_BYTES,
  purgeBadgeFiles,
} from "../supabase/functions/_shared/badges.ts";
import { handleClubProfile } from "../supabase/functions/club-profile/handler.ts";
import type { ClubServices } from "../supabase/functions/club-profile/handler.ts";
const png = new Uint8Array(
  await fs.readFile(
    new URL("./fixtures/transparent-badge.png", import.meta.url),
  ),
);
const jpg = new Uint8Array(
  await fs.readFile(new URL("./fixtures/badge.jpg", import.meta.url)),
);
const base64 = Buffer.from(png).toString("base64");
function fixture() {
  const calls: string[] = [];
  let received: Uint8Array | undefined;
  const services: ClubServices = {
    verify: async () => "owner",
    acquire: async (id, deleting) => {
      calls.push(`acquire:${id}:${deleting}`);
      return "operation";
    },
    release: async () => {
      calls.push("release");
    },
    current: async () => ({ name: "Mi club", badge_path: "owner/old.png" }),
    upload: async (path, bytes, mime) => {
      calls.push(`upload:${path}:${mime}`);
      received = bytes;
    },
    discard: async (path) => {
      calls.push(`discard:${path}`);
    },
    purge: async (id, keep) => {
      calls.push(`purge:${id}:${keep}`);
    },
    save: async (id, op, name, contacts, badge, version) => {
      calls.push(`save:${id}:${name}:${badge}:${version}`);
    },
    remove: async (id, op, name) => {
      calls.push(`delete:${id}:${name}`);
    },
    uuid: () => "file-id",
  };
  const req = (body: unknown, token = "token") =>
    new Request("https://example.invalid", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    });
  return { services, calls, req, received: () => received };
}
test("PNG conserva los bytes originales y admite transparencia; JPG válido también se acepta", () => {
  assert.deepEqual(inspectBadge(png), { mime: "image/png", extension: "png" });
  assert.equal(png[25], 6);
  assert.deepEqual(decodeBadge(base64), png);
  assert.equal(inspectBadge(jpg).mime, "image/jpeg");
  assert.throws(() => inspectBadge(new Uint8Array(MAX_BADGE_BYTES + 1)));
  assert.throws(() =>
    inspectBadge(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
  );
  assert.throws(() => inspectBadge(png.slice(0, 32)));
  const large = png.slice();
  new DataView(large.buffer).setUint32(16, 4097);
  assert.throws(() => inspectBadge(large));
});
test("Escudo: verifica sesión, ignora propietario del cuerpo y no transforma el PNG al subir", async () => {
  const f = fixture();
  assert.equal(
    (await handleClubProfile(f.req({ action: "save" }, ""), f.services)).status,
    401,
  );
  const result = await handleClubProfile(
    f.req({
      action: "save",
      name: "Nuevo club",
      contacts: ["+34611111111"],
      version: 0,
      badge: { base64 },
      owner_id: "victim",
    }),
    f.services,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(f.received(), png);
  assert(f.calls.includes("save:owner:Nuevo club:owner/file-id.png:0"));
  assert(f.calls.includes("purge:owner:owner/file-id.png"));
  assert.equal(f.calls.at(-1), "release");
});
test("Edición conserva escudo si se omite, lo quita si es null y limpia la subida fallida", async () => {
  const f = fixture();
  await handleClubProfile(
    f.req({
      action: "save",
      name: "Renombrado",
      contacts: ["+34611111111"],
      version: 2,
    }),
    f.services,
  );
  assert(f.calls.includes("save:owner:Renombrado:owner/old.png:2"));
  assert(!f.calls.some((c) => c.startsWith("upload:")));
  const remove = fixture();
  await handleClubProfile(
    remove.req({
      action: "save",
      name: "Club",
      contacts: ["+34611111111"],
      version: 2,
      badge: null,
    }),
    remove.services,
  );
  assert(remove.calls.includes("save:owner:Club:null:2"));
  assert(remove.calls.includes("purge:owner:null"));
  const fail = fixture();
  fail.services.save = async () => {
    throw new Error("El club ha cambiado.");
  };
  const response = await handleClubProfile(
    fail.req({
      action: "save",
      name: "Club",
      contacts: ["+34611111111"],
      version: 2,
      badge: { base64 },
    }),
    fail.services,
  );
  assert.equal(response.status, 400);
  assert(fail.calls.includes("discard:owner/file-id.png"));
  assert.equal(fail.calls.at(-1), "release");
});
test("Borrado purga imágenes antes del club; si falla Storage, no elimina el club", async () => {
  const f = fixture();
  await handleClubProfile(
    f.req({ action: "delete", confirmation: "Wrong" }),
    f.services,
  );
  assert(
    !f.calls.some((c) => c.startsWith("purge:") || c.startsWith("delete:")),
  );
  const valid = fixture();
  const result = await handleClubProfile(
    valid.req({ action: "delete", confirmation: "Mi club" }),
    valid.services,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(valid.calls, [
    "acquire:owner:true",
    "purge:owner:null",
    "delete:owner:Mi club",
    "release",
  ]);
  const fail = fixture();
  fail.services.purge = async () => {
    throw new Error("storage offline");
  };
  assert.equal(
    (
      await handleClubProfile(
        fail.req({ action: "delete", confirmation: "Mi club" }),
        fail.services,
      )
    ).status,
    400,
  );
  assert(!fail.calls.some((c) => c.startsWith("delete:")));
});
test("Limpieza usa Storage API y conserva solo el escudo actual", async () => {
  let names = ["new.png", "old.png", "orphan.jpg"];
  const removed: string[][] = [];
  await purgeBadgeFiles(
    {
      from: (bucket: string) => {
        assert.equal(bucket, "club-badges");
        return {
          list: async (prefix: string) => ({
            data: names.map((name) => ({ id: name, name })),
            error: null,
          }),
          remove: async (paths: string[]) => {
            removed.push(paths);
            names = names.filter((n) => !paths.includes("owner/" + n));
            return { error: null };
          },
        };
      },
    },
    "owner",
    "owner/new.png",
  );
  assert.deepEqual(removed, [["owner/old.png", "owner/orphan.jpg"]]);
  assert.deepEqual(names, ["new.png"]);
});
