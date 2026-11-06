export function signInErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("InvalidAccountId")) return "Username does not exist";
  if (message.includes("InvalidSecret")) return "Wrong password";
  return "Could not sign in";
}
