export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 20;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  `Passwords must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long and use only English letters, numbers, and standard special characters, including at least one uppercase letter, one lowercase letter, one special character, and one digit.`;

export function hasOnlyAllowedPasswordCharacters(password: string) {
  return /^[\x21-\x7E]+$/.test(password);
}

export function hasSpecialPasswordCharacter(password: string) {
  return /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(password);
}

export function validatePasswordRequirements(password: string) {
  if (typeof password !== "string") {
    throw new Error('Enter a password');
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long`);
  }
  if (!hasOnlyAllowedPasswordCharacters(password)) {
    throw new Error(
      "Password may contain only English letters, numbers, and standard special characters (no spaces or non-English characters)",
    );
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must include at least one upper case letter');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must include at least one lower case letter');
  }
  if (!/\d/.test(password)) {
    throw new Error('Password must include at least one digit');
  }
  if (!hasSpecialPasswordCharacter(password)) {
    throw new Error('Password must include at least one special character');
  }
}
