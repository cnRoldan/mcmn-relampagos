import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTournamentLink, tournamentLink } from "../src/domain/sharing.ts";
const id = "12345678-1234-4234-8234-123456789abc";
test("Enlace compartible recupera el mismo torneo en web y esquema nativo", () => {
  assert.equal(parseTournamentLink(tournamentLink(id)), id);
  assert.equal(parseTournamentLink("relampagos://torneo/" + id), id);
  assert.equal(parseTournamentLink("http://127.0.0.1:8091/torneo/" + id), id);
});
test("No acepta redirecciones externas ni identificadores mal formados", () => {
  assert.equal(parseTournamentLink("https://evil.example/torneo/" + id), null);
  assert.equal(
    parseTournamentLink(
      "https://mcm-torneos-relampago.netlify.app/torneo/no-valido",
    ),
    null,
  );
  assert.equal(
    parseTournamentLink(
      "https://mcm-torneos-relampago.netlify.app/torneo/" + id + "/extra",
    ),
    null,
  );
  assert.throws(() => tournamentLink("otro"));
});
