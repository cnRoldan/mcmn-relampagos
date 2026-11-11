import { createContext } from "react";
import type { Data, Night, Club, Tournament } from "../domain/tournaments";
export type Context = {
  mode: "local" | "cloud";
  isAdmin: boolean;
  myClub: Club | undefined;
  refresh: () => Promise<void>;
  saveMyClub: (name: string, contacts: string[]) => Promise<void>;
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
