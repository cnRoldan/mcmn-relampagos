import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentTournament,
  tournamentState,
} from "../src/domain/currentTournament.ts";
import {
  normalizePhone,
  validateContacts,
  whatsappLink,
} from "../src/domain/contacts.ts";
import type { Night } from "../src/domain/tournaments.ts";
const n = (id: string, date: string, running = false): Night => ({
  id,
  name: id,
  date,
  time: "22:00",
  clubs: [],
  tournaments: running
    ? [{ id: "c", size: 4, clubIds: ["a", "b", "c", "d"] }]
    : [],
});
test("Inicio prioriza el torneo en curso, después el próximo; omite finalizados", () => {
  const early = n("preparación", "2026-11-13"),
    later = n("posterior", "2026-11-14"),
    running = n("en curso", "2026-11-12", true);
  assert.equal(currentTournament([]), undefined);
  assert.equal(currentTournament([later, early])?.id, early.id);
  assert.equal(currentTournament([early, running])?.id, running.id);
  assert.equal(tournamentState(early), "En preparación");
  assert.equal(tournamentState(running), "En curso");
  running.endedAt = "2026-11-13T00:00:00Z";
  assert.equal(tournamentState(running), "Finalizado");
  assert.equal(currentTournament([running, early])?.id, early.id);
  assert.equal(currentTournament([running]), undefined);
});
test("WhatsApp exige prefijo internacional y crea enlace con mensaje sin enviar", () => {
  assert.equal(normalizePhone("+34 612 345 678"), "+34612345678");
  assert.equal(normalizePhone("0034 (612) 345-678"), "+34612345678");
  for (const invalid of [
    "612345678",
    "+000000000",
    "+34abc612345678",
    "https://evil.test",
    "+1",
    "+1234567890123456",
  ])
    assert.equal(normalizePhone(invalid), null);
  assert.throws(() => validateContacts([]));
  assert.throws(() => validateContacts(["612345678"]));
  assert.deepEqual(validateContacts(["+34 612 345 678", ""]), ["+34612345678"]);
  const url = new URL(whatsappLink("+34 612 345 678", "Club Ñ", "Copa MCM")!);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/34612345678");
  assert.match(url.searchParams.get("text")!, /Club Ñ.*Copa MCM/);
});
