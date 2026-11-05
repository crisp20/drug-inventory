const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_USERNAME_LENGTH = 254;

export function isValidUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return (
    normalized.length <= MAX_USERNAME_LENGTH && EMAIL_PATTERN.test(normalized)
  );
}
