import React, { useState } from "react";
import { Text } from "react-native";
import { useApp } from "../state/AppState";
import { Button, Field, Note, Sheet } from "./UI";
import { styles as s } from "../theme";
export function DeleteClub() {
  const { myClub, deleteMyClub } = useApp();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!myClub) return null;
  return (
    <>
      <Button
        label="Eliminar mi club"
        secondary
        onPress={() => {
          setConfirmation("");
          setError("");
          setOpen(true);
        }}
      />
      {open && (
        <Sheet title="Eliminar mi club" onClose={() => !busy && setOpen(false)}>
          <Text style={s.heading}>{myClub.name}</Text>
          <Note>
            Se borrarán los teléfonos y se retirarán las inscripciones en
            torneos no iniciados. Si hay partidos o historial, se conservarán
            con un nombre genérico y sin vincular el club a tu cuenta. No podrás
            recuperar este club. Tu cuenta seguirá activa.
          </Note>
          <Field
            label="Nombre exacto del club para confirmar"
            value={confirmation}
            onChangeText={setConfirmation}
            maxLength={50}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label={
              busy ? "Eliminando club…" : "Eliminar definitivamente mi club"
            }
            danger
            disabled={busy || confirmation !== myClub.name}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                await deleteMyClub(confirmation);
                setOpen(false);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "No se pudo eliminar el club.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            label="Cancelar"
            secondary
            disabled={busy}
            onPress={() => setOpen(false)}
          />
        </Sheet>
      )}
    </>
  );
}
