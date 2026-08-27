const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isUsableDisplayName(value: string, email?: string) {
  const name = normalizeDisplayName(value);
  if (name.length < 2 || name.length > 80) return false;
  if (EMAIL_LIKE.test(name)) return false;
  if (email && name.toLowerCase() === email.trim().toLowerCase()) return false;
  return true;
}

export function formDisplayName(stored: string | null | undefined, email: string) {
  if (!stored) return "";
  return isUsableDisplayName(stored, email) ? normalizeDisplayName(stored) : "";
}

export function publicDisplayName(
  stored: string | null | undefined,
  fallback = "Participante",
) {
  if (!stored || !isUsableDisplayName(stored)) return fallback;
  return normalizeDisplayName(stored);
}
