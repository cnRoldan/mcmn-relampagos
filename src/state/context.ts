import type { EaClub, EaCandidate, EloEntry } from "../domain/ea";
import type { BadgeInput } from "../domain/badges";
import type { Match, Score } from "../domain/results";
import { createContext } from "react";
import type { Data, Night, Club, Tournament } from "../domain/tournaments";
export type Context = {
  lookupEaClub: (input: string) => Promise<EaClub>;
  linkEaClub: (clubId: string, input: string) => Promise<void>;
  unlinkEaClub: (clubId: string) => Promise<void>;
  verifyEaClub: (clubId: string, version: number) => Promise<void>;
  findEaResults: (
    matchId: string,
  ) => Promise<{ candidates: EaCandidate[]; note: string }>;
  importEaResult: (
    match: Match,
    candidateId: string,
    hp: number | null,
    ap: number | null,
  ) => Promise<void>;
  clubHistory: (clubId: string, offset: number) => Promise<EloEntry[]>;
  mode: "local" | "cloud";
  isAdmin: boolean;
  myClub: Club | undefined;
  refresh: () => Promise<void>;
  deleteMyClub: (confirmation: string) => Promise<void>;
  saveMyClub: (
    name: string,
    contacts: string[],
    badge?: BadgeInput | null,
  ) => Promise<void>;
  updateMyClub: (
    name: string,
    contacts: string[],
    badge?: BadgeInput | null,
  ) => Promise<void>;
  updateContacts: (contacts: string[]) => Promise<void>;
  registerMyClub: (acceptRules?: boolean) => Promise<void>;
  assignCaptain: (clubId: string, eaId: string) => Promise<void>;
  data: Data;
  night: Night | undefined;
  ready: boolean;
  error: string;
  createNight: (
    name: string,
    date: string,
    time: string,
    rules?: string,
  ) => Promise<void>;
  saveResult: (match: Match, score: Score) => Promise<void>;
  startPlayoffs: (
    competitionId: string,
    groupA: string[],
    groupB: string[],
  ) => Promise<void>;
  resetPlayoffs: (competitionId: string) => Promise<void>;
  finishTournament: () => Promise<void>;
  extendStart: (minutes: number) => Promise<void>;
  setExcluded: (
    clubId: string,
    excluded: boolean,
    reason: string,
  ) => Promise<void>;
  listMembers: () => Promise<Member[]>;
  setMemberBan: (
    memberId: string,
    banned: boolean,
    reason: string,
  ) => Promise<void>;
  select: (id: string) => Promise<void>;
  addClub: (name: string, contacts: string[]) => Promise<void>;
  removeClub: (id: string) => Promise<void>;
  confirmPlan: (plan: Tournament[]) => Promise<void>;
  loadDemo: () => Promise<void>;
  reset: () => Promise<void>;
};
export const C = createContext<Context | null>(null);

export type Member = {
  id: string;
  ea_id: string;
  role: "admin" | "captain";
  is_banned: boolean;
  ban_reason: string;
};
