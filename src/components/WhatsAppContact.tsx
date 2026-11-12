import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import { Button } from "./UI";
import { whatsappLink } from "../domain/contacts";
import { styles as s } from "../theme";
export function WhatsAppContact({
  phones,
  fromClub,
  tournamentName,
}: {
  phones: string[];
  fromClub: string;
  tournamentName: string;
}) {
  const [error, setError] = useState("");
  const valid = phones
    .map((phone) => ({
      phone,
      url: whatsappLink(phone, fromClub, tournamentName),
    }))
    .filter((p) => p.url);
  if (!valid.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {valid.map(({ phone, url }, i) => (
        <Button
          key={i}
          secondary
          label={
            valid.length === 1
              ? "Contactar por WhatsApp"
              : `WhatsApp · ${phone}`
          }
          onPress={async () => {
            setError("");
            try {
              await Linking.openURL(url!);
            } catch {
              setError(
                `No se pudo abrir WhatsApp. Puedes contactar con ${phone}.`,
              );
            }
          }}
        />
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
