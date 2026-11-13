import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseEaClub,
  eaClubInfo,
  eaCandidates,
  fetchEa,
} from "../supabase/functions/_shared/ea.ts";
const fixture = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/ea-friendly-sanitized.json", import.meta.url),
    "utf8",
  ),
);
test("EA: club público, pool compartido y URLs sin destinos arbitrarios", () => {
  assert.deepEqual(
    parseEaClub(
      "https://www.ea.com/es-es/games/ea-sports-fc/clubs/overview?clubId=16306&platform=common-gen5",
    ),
    { id: "16306", pool: "common-gen5" },
  );
  assert.deepEqual(parseEaClub("0016306"), {
    id: "16306",
    pool: "common-gen5",
  });
  for (const input of [
    "https://ea.com.evil.test/clubs/?clubId=16306&platform=common-gen5",
    "http://ea.com/clubs/?clubId=16306&platform=common-gen5",
    "https://ea.com/clubs/?clubId=16306&platform=PS5",
    "0",
    "-12",
  ])
    assert.throws(() => parseEaClub(input));
  assert.deepEqual(
    eaClubInfo({ "16306": { clubId: 16306, name: "Wabi Sabi" } }, "16306"),
    { id: "16306", name: "Wabi Sabi" },
  );
  assert.throws(() =>
    eaClubInfo({ "16306": { clubId: 17, name: "Otro" } }, "16306"),
  );
});
test("EA: amistosos reales saneados; resultado por goles, orientación y sin jugadores", () => {
  const m = fixture[0],
    [h, a] = Object.keys(m.clubs),
    start = new Date((m.timestamp - 60) * 1000).toISOString(),
    now = (m.timestamp + 60) * 1000;
  const rows = eaCandidates([m, m], h, a, start, now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].home_goals, Number(m.clubs[h].goals));
  assert.equal(rows[0].away_goals, Number(m.clubs[a].goals));
  assert.equal(
    eaCandidates([m], a, h, start, now)[0].home_goals,
    Number(m.clubs[a].goals),
  );
  assert.equal(eaCandidates([m], h, "123456", start, now).length, 0);
  assert.equal(
    eaCandidates(
      [m],
      h,
      a,
      new Date((m.timestamp + 1) * 1000).toISOString(),
      now,
    ).length,
    0,
  );
  assert.equal(
    eaCandidates([m], h, a, start, (m.timestamp - 301) * 1000).length,
    0,
  );
  const dnf = structuredClone(m);
  dnf.clubs[h].winnerByDnf = 1;
  assert.equal(eaCandidates([dnf], h, a, start, now).length, 0);
  const broken = structuredClone(m);
  broken.clubs[h].goalsAgainst = "99";
  assert.equal(eaCandidates([broken], h, a, start, now).length, 0);
  const missing = structuredClone(m);
  delete missing.aggregate;
  assert.equal(eaCandidates([missing], h, a, start, now)[0].home_red, null);
  assert.deepEqual(eaCandidates(null, h, a, start, now), []);
  assert.throws(() => eaCandidates({}, h, a, start, now));
  assert.equal(JSON.stringify(rows).includes("players"), false);
});
test("EA: fallos del proveedor sin resultados inventados ni evasión del bloqueo", async () => {
  const fetcher = async (url: URL, init: any) => {
    assert.equal(url.hostname, "proclubs.ea.com");
    assert.equal(init.headers.Accept, "application/json");
    return new Response('{"ok":true}');
  };
  assert.deepEqual(
    await fetchEa("clubs/info", { clubIds: "16306" }, fetcher as typeof fetch),
    { ok: true },
  );
  await assert.rejects(
    fetchEa(
      "clubs/info",
      {},
      (async () => new Response("denied", { status: 403 })) as typeof fetch,
    ),
    /HTTP 403/,
  );
  await assert.rejects(
    fetchEa(
      "clubs/info",
      {},
      (async () => new Response("<html>")) as typeof fetch,
    ),
    /JSON/,
  );
});
