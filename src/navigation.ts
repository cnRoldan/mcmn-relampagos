export type TournamentSection =
  | "Listado"
  | "Información"
  | "Inscritos"
  | "Competición";
export type Routes = {
  Inicio: undefined;
  Torneos: { section?: TournamentSection; tournamentId?: string } | undefined;
  "Mi Club": undefined;
  Palmarés: undefined;
  Ajustes: undefined;
};
