import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roundRobin,
  validateClub,
  validatePlan,
  parseData,
} from "../src/domain/tournaments.ts";
import type { Night, Tournament } from "../src/domain/tournaments.ts";
const night = (count: number): Night => ({
  id: "n1",
  name: "Noche",
  date: "2026-11-13",
  time: "22:00",
  clubs: Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Club ${i}`,
    contacts: [],
  })),
  tournaments: [],
});
for (const size of [4, 6])
  test(`Liga de ${size}: parejas únicas y una aparición por jornada`, () => {
    const ids = night(size).clubs.map((c) => c.id),
      rounds = roundRobin(ids),
      pairs = new Set();
    assert.equal(rounds.length, size - 1);
    for (const r of rounds) {
      assert.equal(new Set(r.flat()).size, size);
      for (const [a, b] of r) {
        assert.notEqual(a, b);
        const k = [a, b].sort().join("-");
        assert(!pairs.has(k));
        pairs.add(k);
      }
    }
    assert.equal(pairs.size, (size * (size - 1)) / 2);
    assert.equal(rounds.length + (size === 4 ? 1 : 0), size === 4 ? 4 : 5);
  });
test("Ocho clubes: tres jornadas de grupos y dos eliminatorias", () => {
  const ids = night(8).clubs.map((c) => c.id),
    a = ids.slice(0, 4),
    b = ids.slice(4);
  assert.equal(roundRobin(a).length + 2, 5);
  assert.equal(roundRobin(b).length + 2, 5);
  assert(!a.some((id) => b.includes(id)));
});
test("16 inscritos: dos relámpagos independientes de ocho", () => {
  const n = night(16),
    ids = n.clubs.map((c) => c.id);
  assert.doesNotThrow(() =>
    validatePlan(n, [
      { id: "a", size: 8, clubIds: ids.slice(0, 8) },
      { id: "b", size: 8, clubIds: ids.slice(8) },
    ]),
  );
});
test("No permite omitir, duplicar ni inventar clubes", () => {
  const n = night(8),
    ids = n.clubs.map((c) => c.id);
  const t = (clubIds: string[]): Tournament => ({ id: "t", size: 8, clubIds });
  for (const bad of [
    ids.slice(1),
    [...ids.slice(1), "1"],
    [...ids.slice(1), "extra"],
  ])
    assert.throws(() => validatePlan(n, [t(bad)]));
  assert.throws(() => validatePlan(n, []));
  assert.throws(() =>
    validatePlan(night(5), [{ id: "t", size: 4, clubIds: ids.slice(0, 4) }]),
  );
});
test("Inscripción detecta duplicados y bloquea después de confirmar", () => {
  const n = night(4);
  assert.throws(() => validateClub(n, "  CLUB 0  ", []));
  assert.doesNotThrow(() => validateClub(n, "Otro club", []));
  assert.throws(() => validateClub(n, "  ", []));
  assert.throws(() => validateClub(n, "Otro", ["a", "b", "c", "d"]));
  n.tournaments = [{ id: "a", size: 4, clubIds: n.clubs.map((c) => c.id) }];
  assert.throws(() => validateClub(n, "Otro", []));
  assert.throws(() => validatePlan(n, n.tournaments));
});
test("Persistencia rechaza versiones incompatibles y repartos corruptos", () => {
  const n = night(4),
    d = { version: 1, nights: [n], activeId: n.id };
  assert.deepEqual(parseData(JSON.stringify(d)), d);
  assert.throws(() => parseData("{"));
  assert.throws(() => parseData(JSON.stringify({ ...d, version: 2 })));
  assert.throws(() => parseData(JSON.stringify({ ...d, activeId: "missing" })));
  n.tournaments = [{ id: "t", size: 4, clubIds: ["0", "0", "2", "3"] }];
  assert.throws(() => parseData(JSON.stringify(d)));
});
