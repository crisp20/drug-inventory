export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 20;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  `Passwords must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long and include at least one uppercase letter, one lowercase letter, one special character, and one digit.`;

export function validatePasswordRequirements(password: string) {
  if (typeof password !== "string") {
    throw new Error('Enter a password');
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long`);
  }
  if (!/\p{Lu}/u.test(password)) {
    throw new Error('Password must include at least one upper case letter');
  }
  if (!/\p{Ll}/u.test(password)) {
    throw new Error('Password must include at least one lower case letter');
  }
  if (!/\d/.test(password)) {
    throw new Error('Password must include at least one digit');
  }
  if (!/[\p{P}\p{S}]/u.test(password)) {
    throw new Error('Password must include at least one special character');
  }
}
