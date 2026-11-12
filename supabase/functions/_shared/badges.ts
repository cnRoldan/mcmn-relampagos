export const BADGE_BUCKET = "club-badges";
export const MAX_BADGE_BYTES = 2 * 1024 * 1024;
export function inspectBadge(bytes: Uint8Array): {
  mime: string;
  extension: string;
} {
  if (!bytes.length || bytes.length > MAX_BADGE_BYTES)
    throw new Error("El escudo debe pesar como máximo 2 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dimension = (w: number, h: number) => {
    if (!w || !h || w > 4096 || h > 4096)
      throw new Error("El escudo debe medir como máximo 4096 × 4096 píxeles.");
  };
  if (
    bytes.length >= 45 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  ) {
    if (
      view.getUint32(8) !== 13 ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
    )
      throw new Error("El archivo PNG no es válido.");
    dimension(view.getUint32(16), view.getUint32(20));
    let offset = 8,
      ended = false;
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset);
      if (offset + 12 + size > bytes.length)
        throw new Error("El archivo PNG está incompleto.");
      const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      offset += 12 + size;
      if (type === "IEND") {
        ended = size === 0 && offset === bytes.length;
        break;
      }
    }
    if (!ended) throw new Error("El archivo PNG está incompleto.");
    return { mime: "image/png", extension: "png" };
  }
  if (
    bytes.length > 10 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[bytes.length - 2] === 255 &&
    bytes[bytes.length - 1] === 217
  ) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 216 || (marker >= 208 && marker <= 215)) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 7) break;
        dimension(view.getUint16(offset + 5), view.getUint16(offset + 3));
        return { mime: "image/jpeg", extension: "jpg" };
      }
      offset += length;
    }
  }
  throw new Error(
    "Elige una imagen PNG o JPG válida. Los PNG conservan su transparencia.",
  );
}
export function decodeBadge(base64: string): Uint8Array {
  if (
    typeof base64 !== "string" ||
    base64.length > Math.ceil(MAX_BADGE_BYTES / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  )
    throw new Error("El archivo del escudo no es válido o supera 2 MB.");
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("El archivo del escudo no es válido.");
  }
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
// Deletion always uses Storage API: SQL must never delete storage.objects.
export async function purgeBadgeFiles(
  storage: any,
  ownerId: string,
  keepPath: string | null = null,
) {
  for (let batch = 0; batch < 100; batch++) {
    const { data, error } = await storage
      .from(BADGE_BUCKET)
      .list(ownerId, {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw error;
    const paths = (data || [])
      .filter((f: any) => f.id && `${ownerId}/${f.name}` !== keepPath)
      .map((f: any) => `${ownerId}/${f.name}`);
    if (!paths.length) return;
    const removed = await storage.from(BADGE_BUCKET).remove(paths);
    if (removed.error) throw removed.error;
  }
  throw new Error("No se pudo completar la limpieza de imágenes.");
}
