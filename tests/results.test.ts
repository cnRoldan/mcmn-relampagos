import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialMatches,
  standings,
  groupComplete,
  competitionGroups,
  validateQualifiers,
  validateScore,
  matchWinner,
} from "../src/domain/results.ts";
import type { Tournament } from "../src/domain/tournaments.ts";
let counter = 0;
const uuid = () => String(counter++);
const t = (size: 4 | 6 | 8, format: "liga" | "copa"): Tournament => ({
  id: "t",
  size,
  format,
  clubIds: Array.from({ length: size }, (_, i) => String(i)),
});
test("Calendarios: 4/6 Liga y 4/8 Copa, sin partidos repetidos ni más de cinco por equipo", () => {
  for (const [size, format, total] of [
    [4, "liga", 6],
    [6, "liga", 15],
    [4, "copa", 6],
    [8, "copa", 12],
  ] as const) {
    const plan = t(size, format),
      matches = initialMatches("n", plan, uuid);
    assert.equal(matches.length, total);
    assert.equal(
      new Set(matches.map((m) => [m.home_id, m.away_id].sort().join("-"))).size,
      total,
    );
    for (const group of competitionGroups(plan))
      assert.equal(
        matches.filter((m) => m.phase === group.phase).length,
        (group.ids.length * (group.ids.length - 1)) / 2,
      );
  }
});
test("Clasificación cuenta solo partidos con resultado, incluidos 0–0, y recalcula correcciones", () => {
  const matches = initialMatches("n", t(4, "liga"), uuid);
  assert(
    standings(["0", "1", "2", "3"], matches).every(
      (r) => r.played === 0 && r.points === 0,
    ),
  );
  const m = matches[0];
  m.home_goals = 2;
  m.away_goals = 1;
  const draw = matches.find(
    (x) => x.home_id !== m.home_id && x.away_id !== m.home_id,
  )!;
  draw.home_goals = 0;
  draw.away_goals = 0;
  let table = standings(["0", "1", "2", "3"], matches);
  const winner = table.find((r) => r.clubId === m.home_id)!;
  assert.deepEqual(
    [winner.points, winner.played, winner.gf, winner.ga, winner.gd],
    [3, 1, 2, 1, 1],
  );
  assert.equal(
    table.reduce((sum, r) => sum + r.points, 0),
    5,
  );
  assert.equal(
    table.reduce((sum, r) => sum + r.gf, 0),
    3,
  );
  m.home_goals = 0;
  m.away_goals = 1;
  table = standings(["0", "1", "2", "3"], matches);
  assert.equal(table.find((r) => r.clubId === m.home_id)!.points, 0);
  assert(!groupComplete(["0", "1", "2", "3"], matches));
  for (const game of matches) {
    game.home_goals = 0;
    game.away_goals = 0;
  }
  assert(groupComplete(["0", "1", "2", "3"], matches));
});
test("Desempates por DG y GF; los empates exactos requieren decisión de clasificados", () => {
  const rows = standings(["a", "b", "c", "d"], []);
  rows[0].points = 3;
  rows[0].gd = 2;
  rows[0].gf = 3;
  rows[1].points = 3;
  rows[1].gd = 1;
  rows[1].gf = 4;
  assert.throws(() => validateQualifiers(rows, ["b", "a"]));
  assert.throws(() => validateQualifiers(rows, ["a", "c"]));
  validateQualifiers(rows, ["a", "b"]);
  const tied = standings(["a", "b", "c", "d"], []);
  validateQualifiers(tied, ["d", "a"]);
  assert.throws(() => validateQualifiers(tied, ["a", "a"]));
  assert.throws(() => validateQualifiers(tied, ["a", "fake"]));
});
test("Eliminatorias: empate requiere penaltis distintos; no se suman a las tablas", () => {
  const m = {
    ...initialMatches("n", t(4, "copa"), uuid)[0],
    phase: "final" as const,
  };
  assert.throws(() => validateScore(m, { home: 1, away: 1 }));
  assert.throws(() =>
    validateScore(m, { home: 1, away: 1, homePenalties: 4, awayPenalties: 4 }),
  );
  validateScore(m, { home: 1, away: 1, homePenalties: 4, awayPenalties: 3 });
  m.home_goals = 1;
  m.away_goals = 1;
  m.home_penalties = 4;
  m.away_penalties = 3;
  assert.equal(matchWinner(m), m.home_id);
  assert(
    standings(["0", "1", "2", "3"], [m]).every(
      (r) => r.points === 0 && r.gf === 0,
    ),
  );
  assert.throws(() =>
    validateScore(
      { ...m, phase: "league" },
      { home: 1, away: 1, homePenalties: 4, awayPenalties: 3 },
    ),
  );
  for (const score of [
    { home: 1, away: null },
    { home: -1, away: 0 },
    { home: 1.5, away: 0 },
    { home: 100, away: 0 },
  ])
    assert.throws(() => validateScore(m, score));
  validateScore(m, { home: null, away: null });
});
