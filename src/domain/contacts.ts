/** Require an explicit country prefix; never guess the captain's country. */
export function normalizePhone(value: string): string | null {
  if (!/^[+0-9 ()-]+$/.test(value.trim())) return null;
  const phone = value
    .trim()
    .replace(/[ ()-]/g, "")
    .replace(/^00/, "+");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
export function validateContacts(values: string[]): string[] {
  const phones = values.map((p) => p.trim()).filter(Boolean);
  if (
    !phones.length ||
    phones.length > 3 ||
    phones.some((p) => p.length > 24 || !normalizePhone(p))
  )
    throw new Error(
      "Añade al menos un teléfono válido con prefijo internacional, por ejemplo +34 612 345 678. Máximo tres.",
    );
  return phones.map((p) => normalizePhone(p)!);
}
export function whatsappLink(
  phone: string,
  clubName: string,
  tournamentName: string,
): string | null {
  const number = normalizePhone(phone);
  if (!number) return null;
  const text = `Hola, soy el capitán de ${clubName}. Te contacto por el torneo ${tournamentName}.`;
  return `https://wa.me/${number.slice(1)}?text=${encodeURIComponent(text)}`;
}
