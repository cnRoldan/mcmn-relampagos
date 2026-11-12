import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { inspectBadge } from "../../supabase/functions/_shared/badges";
import { MAX_BADGE_BYTES, toBase64 } from "../domain/badges";
import type { BadgeSelection } from "../domain/badges";
export async function pickBadge(): Promise<BadgeSelection | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_BADGE_BYTES)
    throw new Error("El escudo debe pesar como máximo 2 MB.");
  // Read original file bytes, not ImagePicker's JPEG base64 conversion.
  const bytes =
    Platform.OS === "web" && asset.file
      ? new Uint8Array(await asset.file.arrayBuffer())
      : await new File(asset.uri).bytes();
  const format = inspectBadge(bytes),
    base64 = toBase64(bytes);
  return { base64, uri: `data:${format.mime};base64,${base64}` };
}
