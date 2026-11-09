// Initials printed on labels (e.g. "HS"). Admins can set them per user;
// otherwise they are worked out from the name.
export const MAX_INITIALS_LENGTH = 4;

// "Hubert Suen" -> "HS"; falls back to the first letters of an email
export function initialsOf(name: string | undefined): string {
  const words = (name ?? "")
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const letters =
    words.length === 1
      ? words[0].slice(0, 2)
      : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

// Trims and capitalises typed initials; "" means "not set"
export function normalizeInitials(raw: string): string {
  return raw.trim().toUpperCase();
}

// 1 to 4 letters or digits, after normalising
export function isValidInitials(value: string): boolean {
  return new RegExp(`^[A-Z0-9]{1,${MAX_INITIALS_LENGTH}}$`).test(value);
}

// The initials to print for a user: the admin-set ones, else from the name/email
export function userInitials(
  user: { initials?: string; name?: string; email?: string } | null | undefined,
): string {
  if (user?.initials) return user.initials;
  return initialsOf(user?.name ?? user?.email);
}
