export type TournamentSection = "Noches" | "Inscritos" | "Relámpagos";
export type Routes = {
  Inicio: undefined;
  Torneos: { section?: TournamentSection } | undefined;
  "Mi Club": undefined;
  Palmarés: undefined;
  Ajustes: undefined;
};
