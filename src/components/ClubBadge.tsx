import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { colors } from "../theme";
export function ClubBadge({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return uri && failedUri !== uri ? (
    <Image
      accessibilityLabel={`Escudo de ${name}`}
      source={{ uri }}
      onError={() => setFailedUri(uri)}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  ) : (
    <View
      accessibilityLabel={`Club ${name}, sin escudo`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: colors.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: Math.max(12, Math.round(size * 0.3)),
          fontWeight: "800",
          color: colors.primary,
        }}
      >
        {name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((x) => x[0])
          .join("")
          .toUpperCase()}
      </Text>
    </View>
  );
}
