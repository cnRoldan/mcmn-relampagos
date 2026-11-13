import React, { useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../cloud/AuthProvider";
import { Button, Field, Note, Sheet } from "./UI";
import { styles as s } from "../theme";
export function DeleteAccount() {
  const { deleteAccount, profile } = useAuth();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 12 }}>
      <Button
        label={
          profile?.deletion_pending
            ? "Completar eliminación de mi cuenta"
            : "Eliminar mi perfil y cuenta"
        }
        secondary
        onPress={() => {
          setConfirmation("");
          setPassword("");
          setError("");
          setOpen(true);
        }}
      />
      {open && (
        <Sheet
          title="Eliminar perfil y cuenta"
          onClose={() => {
            if (!busy) {
              setPassword("");
              setOpen(false);
            }
          }}
        >
          <Note>
            Se eliminarán tu perfil y tu acceso a MCMN. También se borrarán los
            teléfonos de tu club y sus inscripciones en torneos no iniciados.
            Los partidos y resultados anteriores se conservarán con un club
            genérico, sin vincularlo a ti. Esta acción es definitiva.
          </Note>
          {profile?.role === "admin" && (
            <Note>También perderás tu acceso de administrador.</Note>
          )}
          <Text style={s.text}>
            No se eliminará tu cuenta de EA ni ningún dato de ConvoSquad.
          </Text>
          <Field
            label="Escribe ELIMINAR"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            maxLength={8}
          />
          <Field
            label="Contraseña actual"
            value={password}
            onChangeText={setPassword}
            secure
            maxLength={128}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label={
              busy ? "Eliminando cuenta…" : "Eliminar definitivamente mi cuenta"
            }
            danger
            disabled={busy || confirmation !== "ELIMINAR" || !password.length}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                await deleteAccount(password);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "No se pudo eliminar la cuenta.",
                );
              } finally {
                setPassword("");
                setBusy(false);
              }
            }}
          />
          <Button
            label="Cancelar"
            secondary
            disabled={busy}
            onPress={() => {
              setPassword("");
              setOpen(false);
            }}
          />
        </Sheet>
      )}
    </View>
  );
}
