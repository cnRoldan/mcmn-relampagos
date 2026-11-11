import { Image, View } from "react-native";

/** Original logo, kept intact with its black background and violet accent. */
export function BrandLogo() {
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 1280 / 426,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#000000",
      }}
    >
      <Image
        source={require("../../assets/mcm-logo.jpg")}
        accessibilityLabel="MCM · Torneos Relámpago"
        accessible
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
