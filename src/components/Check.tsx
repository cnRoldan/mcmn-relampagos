import { Pressable, Text, View } from "react-native";
import { colors, styles as s } from "../theme";
export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={[s.row, { justifyContent: "flex-start", minHeight: 48 }]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: checked ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.white }}>{checked ? "✓" : ""}</Text>
      </View>
      <Text style={[s.text, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
