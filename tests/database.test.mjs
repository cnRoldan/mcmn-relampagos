import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const directory = new URL("../supabase/migrations/", import.meta.url);
const SQL = (
  await Promise.all(
    (await fs.readdir(directory))
      .filter((n) => n.endsWith(".sql"))
      .sort()
      .map((n) => fs.readFile(new URL(n, directory), "utf8")),
  )
).join("\n");
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
        "select public.create_tournament('Torneo de prueba','2020-01-01','22:00','Normas')",
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
        db.query("select public.create_night('Ajena','2020-01-01','22:00')"),
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
      await db.query("select public.join_tournament($1,true)", [n]);
      await db.query("select public.join_tournament($1,true)", [n]);
    });
    await as(db, b, () =>
      db.query("select public.join_tournament($1,true)", [n]),
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
      db.query(
        "select public.set_registration_excluded($1,$2,true,'Fuera temporalmente')",
        [n, ca],
      ),
    );
    await as(db, a, () =>
      assert.rejects(db.query("select public.join_tournament($1,true)", [n])),
    );
    await as(db, admin, () =>
      db.query(
        "select public.set_registration_excluded($1,$2,false,'Readmitido')",
        [n, ca],
      ),
    );
    await as(db, a, () =>
      db.query("select public.join_tournament($1,true)", [n]),
    );
    assert.deepEqual(
      (
        await db.query(
          "select registration_number from public.registrations order by registration_number",
        )
      ).rows.map((r) => Number(r.registration_number)),
      [1, 2],
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

test("Servidor: Copa/Liga, límites y compatibilidad con repartos anteriores", async () => {
  const db = await setup();
  try {
    const plan = (size, format) => [
      {
        id: "t",
        size,
        format,
        clubIds: Array.from({ length: size }, (_, i) => String(i)),
      },
    ];
    for (const [size, format] of [
      [4, "copa"],
      [4, "liga"],
      [6, "liga"],
      [8, "copa"],
    ])
      await db.query("select public.check_competition_plan($1)", [
        JSON.stringify(plan(size, format)),
      ]);
    for (const [size, format] of [
      [8, "liga"],
      [6, "copa"],
      [4, "otro"],
    ])
      await assert.rejects(
        db.query("select public.check_competition_plan($1)", [
          JSON.stringify(plan(size, format)),
        ]),
      );
    await db.query("select public.check_competition_plan($1)", [
      JSON.stringify([
        { id: "legacy", size: 4, clubIds: ["a", "b", "c", "d"] },
      ]),
    ]);
    await assert.rejects(
      db.query("select public.check_competition_plan($1)", [
        JSON.stringify([...plan(4, "liga"), ...plan(4, "copa")]),
      ]),
    );
    await as(db, a, () =>
      assert.rejects(
        db.query("select public.confirm_plan(gen_random_uuid(),$1)", [
          JSON.stringify(plan(4, "liga")),
        ]),
      ),
    );
    const n = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('Liga de prueba','2020-01-01','22:00','Normas')",
      ),
    );
    const ids = [];
    for (let i = 0; i < 4; i++)
      ids.push(
        await as(db, admin, () =>
          one(db, "select (public.admin_register_club($1,$2,'{}')).club_id", [
            n,
            "Liga Club " + i,
          ]),
        ),
      );
    await as(db, admin, () =>
      db.query("select public.confirm_plan($1,$2)", [
        n,
        JSON.stringify([{ id: "liga", size: 4, format: "liga", clubIds: ids }]),
      ]),
    );
    const stored = await one(
      db,
      "select tournaments from public.nights where id=$1",
      [n],
    );
    assert.equal(stored[0].format, "liga");
    assert.equal(
      await one(db, "select status from public.nights where id=$1", [n]),
      "closed",
    );
  } finally {
    await db.close();
  }
});

test("Torneos compartidos: normas, margen, exclusión privada y formato único", async () => {
  const db = await setup();
  try {
    const n = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('Torneo compartible','2020-01-01','22:00','Respeto y puntualidad.')",
      ),
    );
    await as(db, a, () =>
      assert.rejects(
        db.query(
          "select public.create_tournament('No autorizado','2020-01-01','22:00','Normas')",
        ),
      ),
    );
    await as(db, admin, () =>
      assert.rejects(
        db.query(
          "select public.create_tournament('Sin normas','2020-01-01','22:00','')",
        ),
      ),
    );
    const ca = await as(db, a, () =>
        one(db, "select public.create_my_club('Compartible A',array['111'])"),
      ),
      cb = await as(db, b, () =>
        one(db, "select public.create_my_club('Compartible B',array['222'])"),
      );
    await db.exec("set role anon");
    const pub = (
      await db.query("select * from public.get_public_tournament($1)", [n])
    ).rows[0];
    assert.equal(pub.name, "Torneo compartible");
    assert(!("contacts" in pub));
    assert(!("owner_id" in pub));
    await assert.rejects(db.query("select * from public.nights"));
    await assert.rejects(db.query("select * from public.club_contacts"));
    await db.exec("reset role");
    await as(db, a, async () => {
      await assert.rejects(
        db.query("select public.join_tournament($1,false)", [n]),
      );
      await assert.rejects(
        db.query("select public.register_club($1,$2)", [n, ca]),
      );
      await db.query("select public.join_tournament($1,true)", [n]);
      await db.query("select public.join_tournament($1,true)", [n]);
      await assert.rejects(
        db.query("select public.extend_tournament_start($1,10)", [n]),
      );
    });
    await as(db, b, () =>
      db.query("select public.join_tournament($1,true)", [n]),
    );
    const before = await as(db, admin, () =>
      one(
        db,
        "select effective_start from public.list_tournaments() where id=$1",
        [n],
      ),
    );
    await as(db, admin, () =>
      db.query("select public.extend_tournament_start($1,10)", [n]),
    );
    const after = await as(db, admin, () =>
      one(
        db,
        "select effective_start from public.list_tournaments() where id=$1",
        [n],
      ),
    );
    assert.equal(new Date(after) - new Date(before), 600000);
    await as(db, admin, () =>
      db.query(
        "select public.set_registration_excluded($1,$2,true,'Decisión privada')",
        [n, ca],
      ),
    );
    await as(db, a, async () => {
      assert.equal(
        await one(db, "select reason from public.registration_notices"),
        "Decisión privada",
      );
      await assert.rejects(
        db.query("select public.join_tournament($1,true)", [n]),
      );
    });
    await as(db, b, async () => {
      assert.equal(
        (await db.query("select * from public.registration_notices")).rows
          .length,
        0,
      );
      await assert.rejects(
        db.query(
          "select public.set_registration_excluded($1,$2,true,'No autorizado')",
          [n, ca],
        ),
      );
    });
    await as(db, admin, () =>
      db.query(
        "select public.set_registration_excluded($1,$2,false,'Readmitido')",
        [n, ca],
      ),
    );
    assert.equal(
      Number(
        await one(
          db,
          "select registration_number from public.registrations where night_id=$1 and club_id=$2",
          [n, ca],
        ),
      ),
      1,
    );
    for (const label of ["C", "D"])
      await as(db, admin, () =>
        db.query("select public.admin_register_club($1,$2,'{}')", [
          n,
          "Compartible " + label,
        ]),
      );
    const ids = (
      await db.query(
        "select club_id from public.registrations where night_id=$1 order by registration_number",
        [n],
      )
    ).rows.map((r) => r.club_id);
    const t = { id: "only", size: 4, format: "liga", clubIds: ids };
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.confirm_plan($1,$2)", [
          n,
          JSON.stringify([t, { ...t, id: "second" }]),
        ]),
      ),
    );
    await as(db, admin, () =>
      db.query("select public.confirm_plan($1,$2)", [n, JSON.stringify([t])]),
    );
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.extend_tournament_start($1,10)", [n]),
      ),
    );
    const split = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('No dividir','2020-01-01','22:00','Normas')",
      ),
    );
    const eight = [];
    for (let i = 0; i < 8; i++)
      eight.push(
        await as(db, admin, () =>
          one(db, "select (public.admin_register_club($1,$2,'{}')).club_id", [
            split,
            "Ocho " + i,
          ]),
        ),
      );
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.confirm_plan($1,$2)", [
          split,
          JSON.stringify([
            { id: "one", size: 4, format: "copa", clubIds: eight.slice(0, 4) },
            { id: "two", size: 4, format: "copa", clubIds: eight.slice(4) },
          ]),
        ]),
      ),
    );
    const future = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('Futuro',(current_date+1)::date,'22:00','Normas')",
      ),
    );
    const futureIds = [];
    for (let i = 0; i < 4; i++)
      futureIds.push(
        await as(db, admin, () =>
          one(db, "select (public.admin_register_club($1,$2,'{}')).club_id", [
            future,
            "Futuro " + i,
          ]),
        ),
      );
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.confirm_plan($1,$2)", [
          future,
          JSON.stringify([
            { id: "f", size: 4, format: "copa", clubIds: futureIds },
          ]),
        ]),
      ),
    );
  } finally {
    await db.close();
  }
});
test("Baneos: acceso restringido con sesión existente y readmisión explícita", async () => {
  const db = await setup();
  try {
    const n = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('Moderación','2020-01-01','22:00','Normas')",
      ),
    );
    const club = await as(db, a, () =>
      one(db, "select public.create_my_club('Moderado','{}')"),
    );
    await as(db, a, () =>
      db.query("select public.join_tournament($1,true)", [n]),
    );
    await as(db, b, () =>
      assert.rejects(
        db.query("select public.set_member_ban($1,true,'Sin permiso')", [a]),
      ),
    );
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.set_member_ban($1,true,'Autobaneo')", [admin]),
      ),
    );
    await as(db, admin, () =>
      db.query("select public.set_member_ban($1,true,'Suspensión de prueba')", [
        a,
      ]),
    );
    await as(db, a, async () => {
      assert.equal(
        await one(db, "select is_banned from public.profiles where id=$1", [a]),
        true,
      );
      for (const table of ["nights", "clubs", "club_contacts", "registrations"])
        assert.equal(
          (await db.query("select * from public." + table)).rows.length,
          0,
        );
      await assert.rejects(
        db.query("select public.join_tournament($1,true)", [n]),
      );
      await assert.rejects(
        db.query("select public.update_my_contacts(array['222'])"),
      );
      await assert.rejects(
        db.query("select public.create_my_club('Otro','{}')"),
      );
    });
    assert.equal(
      await one(
        db,
        "select excluded from public.registrations where night_id=$1 and club_id=$2",
        [n, club],
      ),
      true,
    );
    await as(db, admin, () =>
      db.query("select public.set_member_ban($1,false,'Fin de suspensión')", [
        a,
      ]),
    );
    await as(db, a, () =>
      assert.rejects(db.query("select public.join_tournament($1,true)", [n])),
    );
    await as(db, admin, () =>
      db.query(
        "select public.set_registration_excluded($1,$2,false,'Readmitido')",
        [n, club],
      ),
    );
    await as(db, a, () =>
      db.query("select public.join_tournament($1,true)", [n]),
    );
  } finally {
    await db.close();
  }
});
