export type BadgeInput = { base64: string };
export type BadgeSelection = BadgeInput & { uri: string };
export const MAX_BADGE_BYTES = 2 * 1024 * 1024;
export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
