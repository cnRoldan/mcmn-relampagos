import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import { Button, Note, Sheet } from "./UI";
import {
  privacyDraft,
  privacySections,
  privacyLinks,
  privacyVersion,
} from "../content/privacy";
import { styles as s } from "../theme";
export function PrivacyPolicyButton() {
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button
        label="Política de tratamiento de datos"
        secondary
        onPress={() => setOpen(true)}
      />
      {open && (
        <Sheet title="Tratamiento de datos" onClose={() => setOpen(false)}>
          <Text style={s.subtitle}>MCMN · Versión {privacyVersion}</Text>
          {privacyDraft && (
            <Note>
              Borrador de desarrollo: falta completar la identidad y el contacto
              del responsable.
            </Note>
          )}
          {privacySections.map((section) => (
            <View key={section.title} style={{ gap: 8 }}>
              <Text accessibilityRole="header" style={s.heading}>
                {section.title}
              </Text>
              <Text selectable style={s.text}>
                {section.text}
              </Text>
            </View>
          ))}
          {privacyLinks.map((link) => (
            <Button
              key={link.url}
              secondary
              label={link.title}
              onPress={() => {
                void Linking.openURL(link.url).catch(() =>
                  setError(`No se pudo abrir ${link.url}`),
                );
              }}
            />
          ))}
          {!!error && <Text style={s.error}>{error}</Text>}
        </Sheet>
      )}
    </>
  );
}
