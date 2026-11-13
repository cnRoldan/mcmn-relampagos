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
  await db.exec(
    `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant select on storage.objects to authenticated;`,
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
      one(db, "select public.create_my_club('Club A',array['+34611111111'])"),
    );
    const cb = await as(db, b, () =>
      one(db, "select public.create_my_club('Club B',array['+34622222222'])"),
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
      one(
        db,
        "select (public.admin_register_club($1,'Club C',array['+34633333333'])).club_id",
        [n],
      ),
    );
    const d = await as(db, admin, () =>
      one(
        db,
        "select (public.admin_register_club($1,'Club D',array['+34633333333'])).club_id",
        [n],
      ),
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
        db.query(
          "select public.admin_register_club($1,'Late',array['+34633333333'])",
          [n],
        ),
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
      db.query(
        "select public.create_my_club('Anonymous',array['+34633333333'])",
      ),
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
          one(
            db,
            "select (public.admin_register_club($1,$2,array['+34633333333'])).club_id",
            [n, "Liga Club " + i],
          ),
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
        one(
          db,
          "select public.create_my_club('Compartible A',array['+34611111111'])",
        ),
      ),
      cb = await as(db, b, () =>
        one(
          db,
          "select public.create_my_club('Compartible B',array['+34622222222'])",
        ),
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
        db.query(
          "select public.admin_register_club($1,$2,array['+34633333333'])",
          [n, "Compartible " + label],
        ),
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
          one(
            db,
            "select (public.admin_register_club($1,$2,array['+34633333333'])).club_id",
            [split, "Ocho " + i],
          ),
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
          one(
            db,
            "select (public.admin_register_club($1,$2,array['+34633333333'])).club_id",
            [future, "Futuro " + i],
          ),
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
      one(db, "select public.create_my_club('Moderado',array['+34633333333'])"),
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
        db.query("select public.update_my_contacts(array['+34622222222'])"),
      );
      await assert.rejects(
        db.query("select public.create_my_club('Otro',array['+34633333333'])"),
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

test("WhatsApp: teléfono obligatorio, contactos entre inscritos y fin de torneo", async () => {
  const db = await setup();
  try {
    const event = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('WhatsApp','2020-01-01','22:00','Normas')",
      ),
    );
    await as(db, a, async () => {
      await assert.rejects(
        db.query("select public.create_my_club('Sin teléfono','{}')"),
      );
      await assert.rejects(
        db.query(
          "select public.create_my_club('Sin prefijo',array['612345678'])",
        ),
      );
    });
    const ca = await as(db, a, () =>
      one(
        db,
        "select public.create_my_club('Equipo A',array['+34 612 345 678'])",
      ),
    );
    const cb = await as(db, b, () =>
      one(
        db,
        "select public.create_my_club('Equipo B',array['0034 622 345 678'])",
      ),
    );
    const count = () =>
      one(db, "select count(*)::int from public.club_contacts");
    await as(db, a, async () => {
      assert.equal(await count(), 1);
      await db.query("select public.join_tournament($1,true)", [event]);
      assert.equal(await count(), 1);
      await assert.rejects(db.query("select public.update_my_contacts('{}')"));
      await assert.rejects(
        db.query("select public.finish_tournament($1)", [event]),
      );
    });
    await as(db, b, () =>
      db.query("select public.join_tournament($1,true)", [event]),
    );
    await as(db, a, async () => assert.equal(await count(), 2));
    await as(db, admin, () =>
      db.query("select public.set_registration_excluded($1,$2,true,'Fuera')", [
        event,
        cb,
      ]),
    );
    await as(db, a, async () => assert.equal(await count(), 1));
    await as(db, b, async () => assert.equal(await count(), 1));
    await as(db, admin, () =>
      db.query(
        "select public.set_registration_excluded($1,$2,false,'Readmitido')",
        [event, cb],
      ),
    );
    await as(db, a, async () => assert.equal(await count(), 2));
    // An unrelated active captain cannot see either phone.
    const outsider = "00000000-0000-4000-8000-000000000099";
    await db.query(
      "insert into auth.users values($1,'other@mcm.invalid','{\"ea_id\":\"OtroCapitan\"}')",
      [outsider],
    );
    await as(db, outsider, async () => assert.equal(await count(), 0));
    const legacyClub = await one(
      db,
      "insert into public.clubs(name,owner_id) values('Club antiguo',$1) returning id",
      [outsider],
    );
    await db.query("insert into public.club_contacts values($1,'{}')", [
      legacyClub,
    ]);
    await as(db, outsider, () =>
      assert.rejects(
        db.query("select public.join_tournament($1,true)", [event]),
      ),
    );
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.registrations where club_id=$1",
        [legacyClub],
      ),
      0,
    );

    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.club_contacts"));
    await db.exec("reset role");
    await as(db, admin, async () => {
      await assert.rejects(
        db.query("select public.finish_tournament($1)", [event]),
      );
      const cc = await one(
        db,
        "select (public.admin_register_club($1,'Equipo C',array['+34633333333'])).club_id",
        [event],
      );
      const cd = await one(
        db,
        "select (public.admin_register_club($1,'Equipo D',array['+34644444444'])).club_id",
        [event],
      );
      await db.query("select public.confirm_plan($1,$2)", [
        event,
        JSON.stringify([
          { id: "liga", size: 4, format: "liga", clubIds: [ca, cb, cc, cd] },
        ]),
      ]);
    });
    await as(db, a, async () => assert.equal(await count(), 4));
    await as(db, admin, () =>
      db.query("select public.finish_tournament($1)", [event]),
    );
    await as(db, a, async () => {
      assert.equal(await count(), 1);
      assert(
        (await db.query("select * from public.list_tournaments_with_status()"))
          .rows[0].ended_at,
      );
    });
    assert.equal(
      await one(db, "select status from public.get_public_tournament($1)", [
        event,
      ]),
      "finished",
    );
    await as(db, admin, async () => {
      assert.equal(await count(), 5);
      await assert.rejects(
        db.query("select public.finish_tournament($1)", [event]),
      );
    });
  } finally {
    await db.close();
  }
});

async function competitionFixture(db, size, format, label) {
  const n = await as(db, admin, () =>
    one(
      db,
      "select public.create_tournament($1,'2020-01-01','22:00','Normas')",
      [label],
    ),
  );
  const ids = [];
  for (let i = 0; i < size; i++)
    ids.push(
      await as(db, admin, () =>
        one(
          db,
          "select (public.admin_register_club($1,$2,array['+34611111111'])).club_id",
          [n, `${label} Club ${i}`],
        ),
      ),
    );
  const plan = { id: `${label}-competition`, size, format, clubIds: ids };
  await as(db, admin, () =>
    db.query("select public.confirm_plan($1,$2)", [n, JSON.stringify([plan])]),
  );
  return { n, ids, plan };
}
async function saveScore(db, m, home, away, hp = null, ap = null) {
  return as(db, admin, () =>
    db.query("select public.save_match_result($1,$2,$3,$4,$5,$6)", [
      m.id,
      m.version,
      home,
      away,
      hp,
      ap,
    ]),
  );
}
const getGames = async (db, n) =>
  (
    await db.query(
      "select * from public.competition_matches where night_id=$1 order by phase,round_number,match_number",
      [n],
    )
  ).rows;
test("Resultados: calendarios, tablas de Liga, permisos y protección frente a sobrescrituras", async () => {
  const db = await setup();
  try {
    for (const [size, format, total] of [
      [4, "liga", 6],
      [6, "liga", 15],
      [4, "copa", 6],
      [8, "copa", 12],
    ]) {
      const { n, ids, plan } = await competitionFixture(
        db,
        size,
        format,
        `Formato${size}${format}`,
      );
      const games = await getGames(db, n);
      assert.equal(games.length, total);
      assert.equal(
        new Set(games.map((m) => [m.home_id, m.away_id].sort().join("-"))).size,
        total,
      );
      if (format !== "liga") continue;
      let table = (
        await db.query("select * from public.competition_standings($1,$2)", [
          n,
          plan.id,
        ])
      ).rows;
      assert.equal(table.length, size);
      assert(table.every((r) => r.points === 0 && r.played === 0));
      const m = games[0];
      await as(db, a, async () => {
        await assert.rejects(
          db.query("select public.save_match_result($1,0,1,0)", [m.id]),
        );
        await assert.rejects(
          db.query(
            "update public.competition_matches set home_goals=99,away_goals=0 where id=$1",
            [m.id],
          ),
        );
        await assert.rejects(
          db.query("select public.seed_competition_matches($1)", [n]),
        );
      });
      await assert.rejects(saveScore(db, m, 1, null));
      await assert.rejects(saveScore(db, m, -1, 0));
      await assert.rejects(saveScore(db, m, 1, 1, 4, 3));
      await saveScore(db, m, 3, 1);
      await assert.rejects(saveScore(db, m, 2, 1), /ha cambiado/);
      table = (
        await db.query("select * from public.competition_standings($1,$2)", [
          n,
          plan.id,
        ])
      ).rows;
      const h = table.find((r) => r.club_id === m.home_id),
        away = table.find((r) => r.club_id === m.away_id);
      assert.deepEqual([h.points, h.played, h.gf, h.ga, h.gd], [3, 1, 3, 1, 2]);
      assert.deepEqual(
        [away.points, away.lost, away.gf, away.ga],
        [0, 1, 1, 3],
      );
      await saveScore(db, { ...m, version: 1 }, 0, 0);
      table = (
        await db.query("select * from public.competition_standings($1,$2)", [
          n,
          plan.id,
        ])
      ).rows;
      assert.equal(
        table.reduce((s, r) => s + r.points, 0),
        2,
      );
      await saveScore(db, { ...m, version: 2 }, null, null);
      assert.equal(
        await one(
          db,
          "select sum(points)::int from public.competition_standings($1,$2)",
          [n, plan.id],
        ),
        0,
      );
      await as(db, admin, () =>
        db.query("select public.finish_tournament($1)", [n]),
      );
      await assert.rejects(saveScore(db, { ...m, version: 3 }, 1, 0));
      await as(db, a, async () =>
        assert.equal(
          (
            await db.query(
              "select * from public.competition_matches where night_id=$1",
              [n],
            )
          ).rows.length,
          total,
        ),
      );
      await db.query("update public.profiles set is_banned=true where id=$1", [
        a,
      ]);
      await as(db, a, async () =>
        assert.equal(
          (await db.query("select * from public.competition_matches")).rows
            .length,
          0,
        ),
      );
      await db.query("update public.profiles set is_banned=false where id=$1", [
        a,
      ]);
    }
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.competition_matches"));
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
test("Copa: clasificados, semifinales cruzadas, penaltis, final y correcciones coherentes", async () => {
  const db = await setup();
  try {
    const { n, ids, plan } = await competitionFixture(
      db,
      8,
      "copa",
      "CopaCompleta",
    );
    await as(db, a, () =>
      assert.rejects(
        db.query("select public.start_playoffs($1,$2,$3,$4)", [
          n,
          plan.id,
          ids.slice(0, 2),
          ids.slice(4, 6),
        ]),
      ),
    );
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.start_playoffs($1,$2,$3,$4)", [
          n,
          plan.id,
          ids.slice(0, 2),
          ids.slice(4, 6),
        ]),
      ),
    );
    let games = await getGames(db, n);
    // Higher seeded clubs win every group fixture: deterministic 9/6/3/0 points.
    for (const m of games)
      await saveScore(
        db,
        m,
        ids.indexOf(m.home_id) < ids.indexOf(m.away_id) ? 2 : 0,
        ids.indexOf(m.home_id) < ids.indexOf(m.away_id) ? 0 : 2,
      );
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.start_playoffs($1,$2,$3,$4)", [
          n,
          plan.id,
          [ids[0], ids[2]],
          ids.slice(4, 6),
        ]),
      ),
    );
    await as(db, admin, () =>
      assert.rejects(
        db.query("select public.start_playoffs($1,$2,$3,$4)", [
          n,
          plan.id,
          ids.slice(0, 2),
          ids.slice(0, 2),
        ]),
      ),
    );
    await as(db, admin, () =>
      db.query("select public.start_playoffs($1,$2,$3,$4)", [
        n,
        plan.id,
        ids.slice(0, 2),
        ids.slice(4, 6),
      ]),
    );
    games = await getGames(db, n);
    let semis = games.filter((m) => m.phase === "semifinal");
    assert.deepEqual(
      semis.map((m) => [m.home_id, m.away_id]),
      [
        [ids[0], ids[5]],
        [ids[4], ids[1]],
      ],
    );
    const group = games.find((m) => m.phase === "group_a");
    await assert.rejects(saveScore(db, group, 4, 0), /Reinicia/);
    await assert.rejects(saveScore(db, semis[0], 1, 1));
    await assert.rejects(saveScore(db, semis[0], 1, 1, 4, 4));
    await saveScore(db, semis[0], 1, 1, 4, 3);
    await saveScore(db, semis[1], 0, 2);
    games = await getGames(db, n);
    const final = games.find((m) => m.phase === "final");
    assert.deepEqual([final.home_id, final.away_id], [ids[0], ids[1]]);
    await assert.rejects(
      saveScore(db, { ...semis[0], version: 1 }, 0, 1),
      /Reinicia/,
    );
    await saveScore(db, final, 2, 0);
    assert.equal(
      await one(
        db,
        "select sum(gf)::int from public.competition_standings($1,$2)",
        [n, plan.id],
      ),
      24,
    );
    assert.equal(
      await one(
        db,
        "select max(played)::int from public.competition_standings($1,$2)",
        [n, plan.id],
      ),
      3,
    );
    // A cup finalist plays three group matches + semifinal + final, never six.
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.competition_matches where night_id=$1 and (home_id=$2 or away_id=$2)",
        [n, ids[0]],
      ),
      5,
    );
    await as(db, a, () =>
      assert.rejects(
        db.query("select public.reset_playoffs($1,$2)", [n, plan.id]),
      ),
    );
    await as(db, admin, () =>
      db.query("select public.reset_playoffs($1,$2)", [n, plan.id]),
    );
    games = await getGames(db, n);
    assert.equal(games.length, 12);
    assert(games.every((m) => m.home_goals !== null));
    await saveScore(db, group, 1, 1);
    // Four-club cup: exact tied groups can be decided by the administrator.
    const four = await competitionFixture(db, 4, "copa", "CopaCuatro");
    for (const m of await getGames(db, four.n)) await saveScore(db, m, 0, 0);
    await as(db, admin, () =>
      db.query("select public.start_playoffs($1,$2,$3,$4)", [
        four.n,
        four.plan.id,
        [four.ids[3], four.ids[1]],
        [],
      ]),
    );
    const fourFinal = (await getGames(db, four.n)).find(
      (m) => m.phase === "final",
    );
    assert.deepEqual(
      [fourFinal.home_id, fourFinal.away_id],
      [four.ids[3], four.ids[1]],
    );
  } finally {
    await db.close();
  }
});

test("Privacidad: eliminar solo mi club retira inscripciones abiertas sin renumerar", async () => {
  const db = await setup();
  try {
    const n = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('Borrado abierto','2020-01-01','22:00','Normas')",
      ),
    );
    const ca = await as(db, a, () =>
      one(db, "select public.create_my_club('Borrable',array['+34611111111'])"),
    );
    const cb = await as(db, b, () =>
      one(
        db,
        "select public.create_my_club('Conservado',array['+34622222222'])",
      ),
    );
    for (const id of [a, b])
      await as(db, id, () =>
        db.query("select public.join_tournament($1,true)", [n]),
      );
    await as(db, a, async () => {
      await assert.rejects(
        db.query("select public.delete_my_club('Conservado')"),
      );
      await assert.rejects(
        db.query("select public.prepare_account_deletion($1)", [b]),
      );
      await assert.rejects(db.query("select public.erase_owned_club($1)", [b]));
      await assert.rejects(
        db.query("select public.delete_my_club('Borrable')"),
      );
    });
    await db.exec("set role service_role");
    const operation = await one(
      db,
      "select public.begin_club_operation($1,true)",
      [a],
    );
    await db.query("select public.delete_club_profile($1,$2,'Borrable')", [
      a,
      operation,
    ]);
    await db.query("select public.end_club_operation($1,$2)", [a, operation]);
    await db.exec("reset role");
    assert.equal(
      await one(db, "select count(*)::int from public.clubs where id=$1", [ca]),
      0,
    );
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.club_contacts where club_id=$1",
        [ca],
      ),
      0,
    );
    assert.equal(
      Number(
        await one(
          db,
          "select registration_number from public.registrations where club_id=$1",
          [cb],
        ),
      ),
      2,
    );
    assert.equal(
      await one(db, "select count(*)::int from auth.users where id=$1", [a]),
      1,
    );
    const replacement = await as(db, a, () =>
      one(db, "select public.create_my_club('Borrable',array['+34611111111'])"),
    );
    await as(db, a, () =>
      db.query("select public.join_tournament($1,true)", [n]),
    );
    assert.equal(
      Number(
        await one(
          db,
          "select registration_number from public.registrations where club_id=$1",
          [replacement],
        ),
      ),
      3,
    );
  } finally {
    await db.close();
  }
});
test("Privacidad: borrar cuenta conserva partidos y bloquea tokens anteriores desde la preparación", async () => {
  const db = await setup();
  try {
    const { n, ids, plan } = await competitionFixture(
      db,
      4,
      "liga",
      "HistorialPrivado",
    );
    await as(db, admin, () =>
      db.query("select public.assign_club_captain($1,'CapitanA')", [ids[0]]),
    );
    await as(db, admin, () =>
      db.query("select public.assign_club_captain($1,'CapitanB')", [ids[1]]),
    );
    const open = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('Abierto privacidad','2020-01-01','22:00','Normas')",
      ),
    );
    for (const id of [a, b])
      await as(db, id, () =>
        db.query("select public.join_tournament($1,true)", [open]),
      );
    // All privileged fixtures remain inside this isolated PostgreSQL instance.
    await db.query("update public.profiles set role='admin' where id=$1", [a]);
    const m = (await getGames(db, n))[0];
    await as(db, a, () =>
      db.query("select public.save_match_result($1,0,2,1)", [m.id]),
    );
    await as(db, a, () =>
      db.query(
        "select public.set_registration_excluded($1,$2,true,'Motivo para otro club')",
        [open, ids[1]],
      ),
    );
    await db.query(
      "insert into public.registration_notices(registration_id,excluded,reason,changed_by) select id,false,'Datos personales del club propio',$2 from public.registrations where night_id=$3 and club_id=$1",
      [ids[0], a, n],
    );
    const ownReg = await one(
      db,
      "select id from public.registrations where night_id=$1 and club_id=$2",
      [n, ids[0]],
    );
    await db.exec("set role service_role");
    await db.query("select public.prepare_account_deletion($1)", [a]);
    await db.exec("reset role");
    assert.equal(
      await one(
        db,
        "select deletion_pending from public.profiles where id=$1",
        [a],
      ),
      true,
    );
    const tombstone = (
      await db.query("select * from public.clubs where id=$1", [ids[0]])
    ).rows[0];
    assert(tombstone.deleted_at);
    assert.equal(tombstone.owner_id, null);
    assert.match(tombstone.name, /^Club eliminado/);
    assert(!tombstone.name.includes("HistorialPrivado"));
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.club_contacts where club_id=$1",
        [ids[0]],
      ),
      0,
    );
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.registration_notices where registration_id=$1",
        [ownReg],
      ),
      0,
    );
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.registrations where night_id=$1 and club_id=$2",
        [open, ids[0]],
      ),
      0,
    );
    assert.equal(
      await one(
        db,
        "select registered_by from public.registrations where id=$1",
        [ownReg],
      ),
      null,
    );
    await as(db, a, async () => {
      for (const table of [
        "clubs",
        "nights",
        "registrations",
        "club_contacts",
        "competition_matches",
      ])
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
      assert.equal(await one(db, "select public.is_admin()"), false);
      await assert.rejects(
        db.query(
          "select public.create_my_club('Reentrada',array['+34611111111'])",
        ),
      );
      await assert.rejects(
        db.query("select public.update_my_contacts(array['+34611111111'])"),
      );
      await assert.rejects(
        db.query("select public.join_tournament($1,true)", [open]),
      );
    });
    await as(db, admin, async () => {
      await assert.rejects(
        db.query("select public.assign_club_captain($1,'CapitanB')", [ids[0]]),
      );
      await assert.rejects(
        db.query("select public.register_club($1,$2)", [open, ids[0]]),
      );
    });
    // Idempotent recovery after an external Auth failure.
    await db.exec("set role service_role");
    await db.query("select public.prepare_account_deletion($1)", [a]);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [a]);
    assert.equal(
      await one(db, "select count(*)::int from public.profiles where id=$1", [
        a,
      ]),
      0,
    );
    assert.equal(
      await one(
        db,
        "select updated_by from public.competition_matches where id=$1",
        [m.id],
      ),
      null,
    );
    assert.equal(
      await one(
        db,
        "select home_goals from public.competition_matches where id=$1",
        [m.id],
      ),
      2,
    );
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.competition_matches where night_id=$1",
        [n],
      ),
      6,
    );
    assert.equal(
      await one(
        db,
        "select sum(points)::int from public.competition_standings($1,$2)",
        [n, plan.id],
      ),
      3,
    );
    assert.equal(
      await one(
        db,
        "select count(*)::int from public.registration_notices where changed_by=$1",
        [a],
      ),
      0,
    );
    await as(db, a, async () =>
      assert.equal(
        (await db.query("select * from public.nights")).rows.length,
        0,
      ),
    );
  } finally {
    await db.close();
  }
});

test("Club: edición de nombre y escudo conserva identidad, orden y permisos privados", async () => {
  const db = await setup();
  try {
    const club = await as(db, a, () =>
      one(
        db,
        "select public.create_my_club('Nombre inicial',array['+34611111111'])",
      ),
    );
    const other = await as(db, b, () =>
      one(
        db,
        "select public.create_my_club('Nombre ocupado',array['+34622222222'])",
      ),
    );
    const n = await as(db, admin, () =>
      one(
        db,
        "select public.create_tournament('Editar club','2020-01-01','22:00','Normas')",
      ),
    );
    await as(db, a, () =>
      db.query("select public.join_tournament($1,true)", [n]),
    );
    const path = `${a}/11111111-1111-4111-8111-111111111111.png`,
      orphan = `${b}/22222222-2222-4222-8222-222222222222.png`;
    for (const file of [path, orphan])
      await db.query(
        "insert into storage.objects(bucket_id,name) values('club-badges',$1)",
        [file],
      );
    await as(db, a, async () => {
      await assert.rejects(
        db.query("select public.begin_club_operation($1,false)", [a]),
      );
      await assert.rejects(
        db.query("update public.clubs set name=$1 where id=$2", [
          "Robado",
          other,
        ]),
      );
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('club-badges',$1)",
          [path + "extra"],
        ),
      );
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
    });
    await db.exec("set role service_role");
    const token = await one(
      db,
      "select public.begin_club_operation($1,false)",
      [a],
    );
    await assert.rejects(
      db.query("select public.begin_club_operation($1,false)", [a]),
    );
    await assert.rejects(
      db.query("select public.prepare_account_deletion($1)", [a]),
    );
    await assert.rejects(
      db.query(
        "select public.save_club_profile($1,null,'No lease',array['+34611111111'],$2,0)",
        [a, path],
      ),
    );
    await assert.rejects(
      db.query(
        "select public.save_club_profile($1,$2,'Cross path',array['+34611111111'],$3,0)",
        [a, token, orphan],
      ),
    );
    await assert.rejects(
      db.query(
        "select public.save_club_profile($1,$2,'Nombre ocupado',array['+34611111111'],$3,0)",
        [a, token, path],
      ),
    );
    assert.equal(
      await one(
        db,
        "select public.save_club_profile($1,$2,'Nombre editado',array['+34611111111'],$3,0)",
        [a, token, path],
      ),
      club,
    );
    await assert.rejects(
      db.query(
        "select public.save_club_profile($1,$2,'Stale',array['+34611111111'],$3,0)",
        [a, token, path],
      ),
    );
    await db.query("select public.end_club_operation($1,$2)", [a, token]);
    await db.exec("reset role");
    assert.equal(
      await one(db, "select name from public.clubs where id=$1", [club]),
      "Nombre editado",
    );
    assert.equal(
      Number(
        await one(
          db,
          "select registration_number from public.registrations where club_id=$1",
          [club],
        ),
      ),
      1,
    );
    for (const user of [a, b])
      await as(db, user, async () => {
        const rows = (await db.query("select name from storage.objects")).rows;
        assert.deepEqual(
          rows.map((r) => r.name),
          [path],
        );
      });
    await db.query("update public.profiles set is_banned=true where id=$1", [
      a,
    ]);
    await as(db, a, async () =>
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      ),
    );
    await db.exec("set role service_role");
    await assert.rejects(
      db.query("select public.begin_club_operation($1,false)", [a]),
    );
    const deleting = await one(
      db,
      "select public.begin_club_operation($1,true)",
      [a],
    );
    await db.query("select public.end_club_operation($1,$2)", [a, deleting]);
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});

test("EA y ELO: solo cruces MCM, validación, importación idempotente y corrección reversible", async () => {
  const db = await setup();
  try {
    const { n, ids } = await competitionFixture(db, 4, "liga", "Elo");
    const m = (await getGames(db, n))[0];
    await db.query("update clubs set owner_id=$1 where id=$2", [a, m.home_id]);
    await assert.rejects(
      as(db, a, () =>
        db.query(
          "select public.set_ea_club_link($1,$2,'16306','common-gen5','fc27','Wabi Sabi')",
          [a, m.home_id],
        ),
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "select public.set_ea_club_link($1,$2,'16306','common-gen5','fc27','Wabi Sabi')",
        [b, m.home_id],
      ),
      /propio club/,
    );
    await db.query(
      "select public.set_ea_club_link($1,$2,'16306','common-gen5','fc27','Wabi Sabi')",
      [a, m.home_id],
    );
    await db.query(
      "select public.set_ea_club_link($1,$2,'999','common-gen5','fc27','Rival')",
      [admin, m.away_id],
    );
    await assert.rejects(
      db.query("select public.ea_match_context($1,$2)", [admin, m.id]),
      /Falta validar/,
    );
    await assert.rejects(
      db.query("select public.verify_ea_club_link($1,$2,1)", [a, m.home_id]),
      /administradores/,
    );
    await db.query("select public.verify_ea_club_link($1,$2,1)", [
      admin,
      m.home_id,
    ]);
    await assert.rejects(
      db.query("select public.verify_ea_club_link($1,$2,1)", [
        admin,
        m.home_id,
      ]),
      /ha cambiado/,
    );
    await assert.rejects(
      db.query(
        "select public.set_ea_club_link($1,$2,'16306','common-gen5','fc27','Duplicado')",
        [admin, ids.find((id) => ![m.home_id, m.away_id].includes(id))],
      ),
      /unique/,
    );
    // Only this isolated fixture backdates verification, never real accounts.
    await db.exec(
      "update club_ea_links set verified_at='2020-01-01'::timestamptz",
    );
    let context = await one(db, "select public.ea_match_context($1,$2)", [
      admin,
      m.id,
    ]);
    const row = {
      ea_match_id: "777",
      played_at: "2020-01-02T00:00:00Z",
      home_goals: 2,
      away_goals: 1,
      home_red: 1,
      away_red: null,
    };
    await assert.rejects(
      db.query("select public.cache_ea_match_candidates($1,$2,$3,$4)", [
        admin,
        m.id,
        { ...context, version: 999 },
        [row],
      ]),
      /han cambiado/,
    );
    await assert.rejects(
      db.query("select public.cache_ea_match_candidates($1,$2,$3,$4)", [
        admin,
        m.id,
        context,
        [{ ...row, played_at: "2019-01-01T00:00:00Z" }],
      ]),
      /ventana/,
    );
    await db.query("select public.cache_ea_match_candidates($1,$2,$3,$4)", [
      admin,
      m.id,
      context,
      [row],
    ]);
    assert.equal(await one(db, "select count(*) from club_elo_history"), 0);
    const cid = await one(
      db,
      "select id from ea_match_candidates where mcm_match_id=$1",
      [m.id],
    );
    await assert.rejects(
      as(db, a, () =>
        db.query("select public.import_ea_match($1,$2,$3)", [
          admin,
          cid,
          m.version,
        ]),
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.import_ea_match($1,$2,$3)", [a, cid, m.version]),
      /administradores/,
    );
    await assert.rejects(
      db.query("select public.import_ea_match($1,$2,$3)", [admin, cid, 999]),
      /ha cambiado/,
    );
    await db.query("select public.import_ea_match($1,$2,$3)", [
      admin,
      cid,
      m.version,
    ]);
    await db.query("select public.import_ea_match($1,$2,$3)", [
      admin,
      cid,
      m.version,
    ]);
    let saved = (
      await db.query("select * from competition_matches where id=$1", [m.id])
    ).rows[0];
    assert.equal(saved.ea_match_id, "777");
    assert.equal(saved.ea_home_red, 1);
    assert.equal(saved.ea_away_red, null);
    const duplicate = await one(
      db,
      "insert into competition_matches(night_id,competition_id,phase,round_number,match_number,home_id,away_id) values($1,'duplicate-test','league',1,1,$2,$3) returning id",
      [n, m.home_id, m.away_id],
    );
    const ctx2 = await one(db, "select public.ea_match_context($1,$2)", [
      admin,
      duplicate,
    ]);
    await db.query("select public.cache_ea_match_candidates($1,$2,$3,$4)", [
      admin,
      duplicate,
      ctx2,
      [row],
    ]);
    const cid2 = await one(
      db,
      "select id from ea_match_candidates where mcm_match_id=$1",
      [duplicate],
    );
    await assert.rejects(
      db.query("select public.import_ea_match($1,$2,0)", [admin, cid2]),
      /otro encuentro MCM/,
    );
    assert.equal(await one(db, "select count(*) from club_elo_history"), 2);
    assert.equal(
      await one(db, "select rating from club_elo where club_id=$1", [
        m.home_id,
      ]),
      1016,
    );
    assert.equal(
      await one(db, "select rating from club_elo where club_id=$1", [
        m.away_id,
      ]),
      984,
    );
    assert.equal(
      await one(db, "select sum(rating) from club_elo"),
      ids.length * 1000,
    );
    const history = await as(db, a, () =>
      db.query("select * from mcm_club_history($1)", [m.home_id]),
    );
    assert.equal(history.rows[0].delta, 16);
    assert.equal(history.rows[0].round_number, m.round_number);
    assert.equal(history.rows[0].ea_match_id, "777");
    assert.equal(history.rows[0].red_cards, 1);
    await assert.rejects(saveScore(db, saved, 1, 2), /pendiente/);
    await assert.rejects(
      db.query("select public.set_ea_club_link($1,$2,null,null,null,null)", [
        admin,
        m.home_id,
      ]),
      /resultados importados/,
    );
    await saveScore(db, saved, null, null);
    assert.equal(await one(db, "select count(*) from club_elo_history"), 0);
    assert.equal(
      await one(db, "select rating from club_elo where club_id=$1", [
        m.home_id,
      ]),
      1000,
    );
    saved = (
      await db.query("select * from competition_matches where id=$1", [m.id])
    ).rows[0];
    assert.equal(saved.ea_match_id, null);
    await saveScore(db, saved, 0, 1);
    assert.equal(
      await one(db, "select rating from club_elo where club_id=$1", [
        m.home_id,
      ]),
      984,
    );
    assert.equal(await one(db, "select count(*) from club_elo_history"), 2);
    await db.query("update profiles set is_banned=true where id=$1", [a]);
    assert.equal(
      (
        await as(db, a, () =>
          db.query("select * from mcm_club_history($1)", [m.home_id]),
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("ELO: partidos externos no puntúan, empates, penaltis, reinicio y borrado conservan coherencia", async () => {
  const db = await setup();
  try {
    const { n, ids, plan } = await competitionFixture(db, 4, "copa", "EloCopa");
    const games = await getGames(db, n);
    for (const m of games) await saveScore(db, m, 0, 0);
    assert.equal(await one(db, "select count(*) from club_elo_history"), 12);
    assert.equal(
      await one(db, "select count(*) from club_elo where rating=1000"),
      4,
    );
    await as(db, admin, () =>
      db.query("select public.start_playoffs($1,$2,$3,$4)", [
        n,
        plan.id,
        ids.slice(0, 2),
        [],
      ]),
    );
    const final = (await getGames(db, n)).find((m) => m.phase === "final");
    await saveScore(db, final, 1, 1, 5, 4);
    assert.equal(
      await one(db, "select rating from club_elo where club_id=$1", [
        final.home_id,
      ]),
      1016,
    );
    await as(db, admin, () =>
      db.query("select public.reset_playoffs($1,$2)", [n, plan.id]),
    );
    assert.equal(await one(db, "select count(*) from club_elo_history"), 12);
    assert.equal(
      await one(db, "select count(*) from club_elo where rating=1000"),
      4,
    );
    await db.query("update clubs set owner_id=$1 where id=$2", [a, ids[0]]);
    await db.query(
      "select public.set_ea_club_link($1,$2,'16306','common-gen5','fc27','Wabi Sabi')",
      [a, ids[0]],
    );
    await db.query("select public.erase_owned_club($1)", [a]);
    assert.equal(await one(db, "select count(*) from club_ea_links"), 0);
    assert.equal(await one(db, "select count(*) from club_elo_history"), 12);
    assert.equal(
      await one(db, "select owner_id from clubs where id=$1", [ids[0]]),
      null,
    );
  } finally {
    await db.close();
  }
});
