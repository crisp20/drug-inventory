const EMAIL_PATTERN = /^[a-zA-Z0-9\-\_\.]+@[a-zA-Z0-9\-\_\.]+\.[a-zA-Z0-9\-\_\.]+$/;
export const MAX_USERNAME_LENGTH = 254;

export function isValidUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return (
    normalized.length <= MAX_USERNAME_LENGTH && EMAIL_PATTERN.test(normalized) && !normalized.endsWith('.')
  );
}
