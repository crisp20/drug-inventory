export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 20;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Passwords must be 12-20 characters long and include at least one uppercase letter, one lowercase letter, one special character, and one digit.";

export function validatePasswordRequirements(password: string) {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH ||
    !/\p{Lu}/u.test(password) ||
    !/\p{Ll}/u.test(password) ||
    !/\d/.test(password) ||
    !/[\p{P}\p{S}]/u.test(password)
  ) {
    throw new Error(PASSWORD_REQUIREMENTS_MESSAGE);
  }
}
