export { parseEaClub } from "../../supabase/functions/_shared/ea";
export type EaLink = {
  club_id: string;
  edition: string;
  platform: string;
  ea_club_id: string;
  ea_name: string;
  verified_at: string | null;
  link_version: number;
};
export type EaClub = {
  id: string;
  name: string;
  platform: string;
  edition: string;
};
export type EaCandidate = {
  id: string;
  mcm_match_id: string;
  ea_match_id: string;
  played_at: string;
  home_goals: number;
  away_goals: number;
  home_red: number | null;
  away_red: number | null;
  fetched_at: string;
};
export type McmStats = {
  club_id: string;
  rating: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
};
export type EloEntry = {
  match_id: string;
  played_at: string;
  tournament_name: string;
  phase: string;
  round_number: number;
  opponent_name: string;
  my_goals: number;
  their_goals: number;
  my_penalties: number | null;
  their_penalties: number | null;
  rating_before: number;
  rating_after: number;
  delta: number;
  ea_match_id: string | null;
  red_cards: number | null;
};
