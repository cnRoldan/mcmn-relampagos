import React, { createContext, useContext, useEffect, useState } from "react";
import { Linking, Platform, Share } from "react-native";
import { parseTournamentLink, tournamentLink } from "../domain/sharing";
export { parseTournamentLink, tournamentLink } from "../domain/sharing";
export async function shareTournament(id: string, name: string) {
  const url = tournamentLink(id);
  if (Platform.OS !== "web") {
    await Share.share({
      message: `${name}\nInscripción al torneo: ${url}`,
      url,
    });
    return "Enlace preparado para compartir.";
  }
  const nav = globalThis.navigator as Navigator & {
    share?: (data: { title: string; url: string }) => Promise<void>;
  };
  if (nav?.share) {
    await nav.share({ title: name, url });
    return "Enlace compartido.";
  }
  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(url);
    return "Enlace copiado.";
  }
  return "Puedes copiar el enlace que aparece en la ficha.";
}
const C = createContext<string | null>(null);
export function TournamentLinkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [id, setId] = useState<string | null>(() =>
    Platform.OS === "web" && typeof window !== "undefined"
      ? parseTournamentLink(window.location.href)
      : null,
  );
  useEffect(() => {
    let alive = true;
    void Linking.getInitialURL().then((url) => {
      if (alive && url) setId(parseTournamentLink(url));
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      const found = parseTournamentLink(url);
      if (found) setId(found);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return <C.Provider value={id}>{children}</C.Provider>;
}
export function useTournamentLink() {
  return useContext(C);
}
