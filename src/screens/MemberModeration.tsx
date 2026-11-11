import React, { useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "../state/AppState";
import type { Member } from "../state/context";
import { Button, Field, Note, Sheet } from "../components/UI";
import { styles as s } from "../theme";
export function MemberModeration() {
  const { listMembers, setMemberBan, isAdmin, mode } = useApp(),
    [open, setOpen] = useState(false),
    [members, setMembers] = useState<Member[]>([]),
    [selected, setSelected] = useState<Member | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!isAdmin || mode !== "cloud") return null;
  async function load() {
    setBusy(true);
    setError("");
    try {
      setMembers(await listMembers());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar las cuentas.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        label="Gestionar capitanes y baneos"
        secondary
        onPress={() => {
          setOpen(true);
          void load();
        }}
      />
      {open && (
        <Sheet
          title="Capitanes de la comunidad"
          onClose={() => !busy && setOpen(false)}
        >
          {selected ? (
            <>
              <Text style={s.heading}>{selected.ea_id}</Text>
              <Note>
                {selected.is_banned
                  ? "Quitar el baneo restablece el acceso. Los clubes excluidos deberán readmitirse en cada torneo."
                  : "El baneo bloquea el acceso a la comunidad y deja su club fuera de los torneos con inscripción abierta."}
              </Note>
              <Field
                label="Motivo de la decisión"
                value={reason}
                onChangeText={setReason}
                maxLength={500}
                multiline
              />
              <Button
                label={
                  busy
                    ? "Guardando…"
                    : selected.is_banned
                      ? "Quitar baneo"
                      : "Confirmar baneo"
                }
                disabled={busy}
                onPress={async () => {
                  if (!reason.trim()) {
                    setError("Indica el motivo de la decisión.");
                    return;
                  }
                  setBusy(true);
                  setError("");
                  try {
                    await setMemberBan(
                      selected.id,
                      !selected.is_banned,
                      reason,
                    );
                    setSelected(null);
                    setMembers(await listMembers());
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "No se pudo guardar.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                secondary
                label="Volver a la lista"
                disabled={busy}
                onPress={() => {
                  setSelected(null);
                  setError("");
                }}
              />
            </>
          ) : (
            <>
              {members.map((m) => (
                <View style={s.card} key={m.id}>
                  <Text style={s.heading}>{m.ea_id}</Text>
                  <Text style={s.subtitle}>
                    {m.role === "admin"
                      ? "Administrador"
                      : m.is_banned
                        ? "Capitán baneado"
                        : "Capitán activo"}
                  </Text>
                  {m.is_banned && !!m.ban_reason && (
                    <Text style={s.text}>{m.ban_reason}</Text>
                  )}
                  {m.role !== "admin" && (
                    <Button
                      label={m.is_banned ? "Quitar baneo" : "Banear capitán"}
                      secondary
                      disabled={busy}
                      onPress={() => {
                        setSelected(m);
                        setReason(
                          m.is_banned
                            ? "Acceso restablecido por la organización."
                            : "",
                        );
                        setError("");
                      }}
                    />
                  )}
                </View>
              ))}
              <Button
                label={busy ? "Actualizando…" : "Actualizar cuentas"}
                secondary
                disabled={busy}
                onPress={() => void load()}
              />
            </>
          )}
          {!!error && (
            <Text style={s.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
        </Sheet>
      )}
    </>
  );
}
