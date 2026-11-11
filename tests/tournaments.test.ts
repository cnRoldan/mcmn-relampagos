import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roundRobin,
  validateClub,
  validatePlan,
  parseData,
  maxMatches,
  competitionPhases,
  defaultFormat,
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
  test(`Todos contra todos de ${size}: parejas únicas y una aparición por jornada`, () => {
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
  });
test("Ocho clubes: tres jornadas de grupos y dos eliminatorias", () => {
  const ids = night(8).clubs.map((c) => c.id),
    a = ids.slice(0, 4),
    b = ids.slice(4);
  assert.equal(roundRobin(a).length + 2, 5);
  assert.equal(roundRobin(b).length + 2, 5);
  assert(!a.some((id) => b.includes(id)));
});
test("Compatibilidad de datos antiguos con varios cuadros", () => {
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

test("Copa y Liga tienen rondas distintas con cuatro clubes", () => {
  const ids = ["a", "b", "c", "d"];
  const liga = {
      id: "l",
      size: 4 as const,
      format: "liga" as const,
      clubIds: ids,
    },
    copa = { ...liga, id: "c", format: "copa" as const };
  assert.equal(competitionPhases(liga).length, 1);
  assert.equal(competitionPhases(liga)[0].rounds.length, 3);
  assert.equal(maxMatches(4, "liga"), 3);
  assert.equal(competitionPhases(copa).at(-1)?.title, "Final");
  assert.equal(maxMatches(4, "copa"), 4);
  assert.equal(defaultFormat(4), "copa");
  assert.throws(() => maxMatches(8, "liga"));
  assert.throws(() => maxMatches(6, "copa"));
});
test("El reparto rechaza Liga de ocho, Copa de seis y formatos desconocidos", () => {
  for (const [count, kind] of [
    [8, "liga"],
    [6, "copa"],
    [4, "otro"],
  ] as const) {
    const n = night(count);
    assert.throws(() =>
      validatePlan(n, [
        {
          id: "t",
          size: count as 4 | 6 | 8,
          format: kind as "liga",
          clubIds: n.clubs.map((c) => c.id),
        },
      ]),
    );
  }
});

test("Un torneo único usa solo los participantes no excluidos", () => {
  const n = night(6);
  n.singleTournament = true;
  n.clubs[4].excluded = true;
  n.clubs[5].excluded = true;
  assert.doesNotThrow(() =>
    validatePlan(n, [
      {
        id: "t",
        size: 4,
        format: "copa",
        clubIds: n.clubs.slice(0, 4).map((c) => c.id),
      },
    ]),
  );
  assert.throws(() =>
    validatePlan(n, [
      { id: "t", size: 6, format: "liga", clubIds: n.clubs.map((c) => c.id) },
    ]),
  );
  const many = night(8);
  many.singleTournament = true;
  assert.throws(() =>
    validatePlan(many, [
      { id: "a", size: 4, clubIds: many.clubs.slice(0, 4).map((c) => c.id) },
      { id: "b", size: 4, clubIds: many.clubs.slice(4).map((c) => c.id) },
    ]),
  );
});
