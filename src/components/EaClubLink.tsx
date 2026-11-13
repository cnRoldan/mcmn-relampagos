import React, { useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "../state/AppState";
import type { Club } from "../domain/tournaments";
import type { EaClub } from "../domain/ea";
import { Button, Badge, Field, Note, Sheet, Confirm } from "./UI";
import { styles as s } from "../theme";
export function EaClubLink({ club }: { club: Club }) {
  const {
    isAdmin,
    lookupEaClub,
    linkEaClub,
    unlinkEaClub,
    verifyEaClub,
    myClub,
  } = useApp();
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [found, setFound] = useState<EaClub | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const link = club.eaLink,
    canEdit = isAdmin || myClub?.id === club.id;
  if (club.deletedAt) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.heading}>Club de EA</Text>
      {link ? (
        <>
          <Badge>
            {link.verified_at ? "VÍNCULO VALIDADO" : "PENDIENTE DE VALIDACIÓN"}
          </Badge>
          <Text style={s.text}>
            {link.ea_name} · ID {link.ea_club_id}
          </Text>
          <Text style={s.subtitle}>{link.platform} · Edición actual de EA</Text>
          {!link.verified_at && (
            <Note>
              La organización debe validar que este club corresponde al equipo
              que representas antes de importar partidos.
            </Note>
          )}
        </>
      ) : (
        <Text style={s.subtitle}>
          Vincula el club de EA para que la organización pueda recuperar los
          resultados de sus cruces MCMN.
        </Text>
      )}
      {canEdit && (
        <Button
          secondary
          label={link ? "Cambiar vínculo EA" : "Vincular club EA"}
          onPress={() => {
            setError("");
            setFound(null);
            setInput("");
            setOpen(true);
          }}
        />
      )}
      {isAdmin && link && !link.verified_at && (
        <Confirm
          label="Validar vínculo EA"
          title="Validar club de EA"
          message={`Confirma que ${link.ea_name} (ID ${link.ea_club_id}) corresponde a ${club.name}. El enlace público de EA no acredita quién es su capitán.`}
          onConfirm={() => verifyEaClub(club.id, link.link_version)}
        />
      )}
      {canEdit && link && (
        <Confirm
          label="Quitar vínculo EA"
          title="Quitar vínculo EA"
          message="Se retirará la vinculación. Los resultados MCMN se conservan. Si ya hay partidos importados, esta operación no estará disponible."
          onConfirm={() => unlinkEaClub(club.id)}
        />
      )}
      {open && (
        <Sheet title="Vincular club EA" onClose={() => !busy && setOpen(false)}>
          <Note>
            Pega el enlace de Clubes de EA o su ID. common-gen5 agrupa PS5, Xbox
            Series y PC. No pedimos la contraseña de tu cuenta de EA.
          </Note>
          <Field
            label="Enlace o ID del club EA"
            value={input}
            onChangeText={(v) => {
              setInput(v);
              setFound(null);
            }}
            maxLength={400}
            autoCapitalize="none"
            placeholder="https://www.ea.com/…?clubId=16306&platform=common-gen5"
          />
          <Button
            label={busy ? "Consultando…" : "Comprobar club en EA"}
            disabled={busy || !input.trim()}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                setFound(await lookupEaClub(input));
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "EA no está disponible.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          {found && (
            <View style={s.card}>
              <Text style={s.heading}>{found.name}</Text>
              <Text style={s.text}>
                ID {found.id} · {found.platform}
              </Text>
              <Text style={s.subtitle}>
                Solo se utilizarán para puntuar los partidos de nuestros
                relámpagos, no el historial general de EA.
              </Text>
              <Button
                label={
                  busy
                    ? "Guardando…"
                    : isAdmin
                      ? "Vincular y validar club"
                      : "Solicitar esta vinculación"
                }
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await linkEaClub(club.id, input);
                    setOpen(false);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "No se pudo vincular.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
        </Sheet>
      )}
    </View>
  );
}
