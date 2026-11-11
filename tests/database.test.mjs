import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const SQL = await fs.readFile(
  new URL(
    "../supabase/migrations/202611110001_captains_and_registration.sql",
    import.meta.url,
  ),
  "utf8",
);
const admin = "00000000-0000-4000-8000-000000000001",
  a = "00000000-0000-4000-8000-000000000002",
  b = "00000000-0000-4000-8000-000000000003";
async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`,
  );
  await db.exec(SQL);
  for (const [id, ea] of [
    [admin, "MCMN Relámpagos"],
    [a, "CapitanA"],
    [b, "CapitanB"],
  ])
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      ea + "@mcm.invalid",
      JSON.stringify({ ea_id: ea, role: "admin" }),
    ]);
  await db.query("update public.profiles set role='admin' where id=$1", [
    admin,
  ]);
  return db;
}
async function as(db, id, fn) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const one = async (db, sql, args = []) =>
  Object.values((await db.query(sql, args)).rows[0])[0];
test("Servidor: roles, contactos, orden de llegada y cierre transaccional", async () => {
  const db = await setup();
  try {
    const n = await as(db, admin, () =>
      one(
        db,
        "select public.create_night('Noche de prueba','2026-11-14','22:00')",
      ),
    );
    const ca = await as(db, a, () =>
      one(db, "select public.create_my_club('Club A',array['111'])"),
    );
    const cb = await as(db, b, () =>
      one(db, "select public.create_my_club('Club B',array['222'])"),
    );
    await as(db, a, async () => {
      assert.equal(
        await one(db, "select role from public.profiles where id=$1", [a]),
        "captain",
      );
      await assert.rejects(
        db.query("update public.profiles set role='admin' where id=$1", [a]),
      );
      await assert.rejects(
        db.query("select public.create_night('Ajena','2026-11-14','22:00')"),
      );
      await assert.rejects(
        db.query("select public.register_club($1,$2)", [n, cb]),
      );
      assert.equal(
        (await db.query("select * from public.club_contacts")).rows.length,
        1,
      );
      await assert.rejects(
        db.query("select public.auth_email_for_ea('CapitanB')"),
      );
      await assert.rejects(
        db.query(
          "insert into public.registrations(night_id,club_id,registration_number,registered_by) values($1,$2,1,$3)",
          [n, ca, a],
        ),
      );
      await db.query("select public.register_club($1,$2)", [n, ca]);
      await assert.rejects(
        db.query("select public.register_club($1,$2)", [n, ca]),
      );
    });
    await as(db, b, () =>
      db.query("select public.register_club($1,$2)", [n, cb]),
    );
    const rows = (
      await db.query(
        "select club_id,registration_number from public.registrations order by registration_number",
      )
    ).rows;
    assert.deepEqual(
      rows.map((r) => Number(r.registration_number)),
      [1, 2],
    );
    assert.deepEqual(
      rows.map((r) => r.club_id),
      [ca, cb],
    );
    await as(db, admin, () =>
      db.query("select public.remove_registration($1,$2)", [n, ca]),
    );
    await as(db, a, () =>
      db.query("select public.register_club($1,$2)", [n, ca]),
    );
    assert.deepEqual(
      (
        await db.query(
          "select registration_number from public.registrations order by registration_number",
        )
      ).rows.map((r) => Number(r.registration_number)),
      [2, 3],
    );
    const c = await as(db, admin, () =>
      one(db, "select (public.admin_register_club($1,'Club C','{}')).club_id", [
        n,
      ]),
    );
    const d = await as(db, admin, () =>
      one(db, "select (public.admin_register_club($1,'Club D','{}')).club_id", [
        n,
      ]),
    );
    await as(db, a, () =>
      assert.rejects(
        db.query("select public.confirm_plan($1,$2)", [
          n,
          JSON.stringify([{ id: "t", size: 4, clubIds: [ca, cb, c, d] }]),
        ]),
      ),
    );
    await as(db, admin, async () => {
      await assert.rejects(
        db.query("select public.confirm_plan($1,$2)", [
          n,
          JSON.stringify([{ id: "t", size: 4, clubIds: [ca, ca, c, d] }]),
        ]),
      );
      await db.query("select public.confirm_plan($1,$2)", [
        n,
        JSON.stringify([{ id: "t", size: 4, clubIds: [ca, cb, c, d] }]),
      ]);
    });
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.admin_register_club($1,'Late','{}')", [n]),
      ),
    );
    assert.equal(
      await one(db, "select count(*) from public.clubs where name=$1", [
        "Late",
      ]),
      0,
      "A failed registration must roll back club creation",
    );
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.club_contacts"));
    await assert.rejects(
      db.query("select public.create_my_club('Anonymous','{}')"),
    );
  } finally {
    await db.close();
  }
});
test("Servidor: EA ID normalizado y límite de intentos inaccesible al capitán", async () => {
  const db = await setup();
  try {
    assert.equal(
      await one(db, "select public.auth_email_for_ea('  mcmn   relámpagos ')"),
      "MCMN Relámpagos@mcm.invalid",
    );
    const key = "a".repeat(64);
    for (let i = 0; i < 12; i++)
      assert.equal(
        await one(db, "select public.consume_auth_attempt($1)", [key]),
        true,
      );
    assert.equal(
      await one(db, "select public.consume_auth_attempt($1)", [key]),
      false,
    );
    await as(db, a, () =>
      assert.rejects(db.query("select public.consume_auth_attempt($1)", [key])),
    );
  } finally {
    await db.close();
  }
});
