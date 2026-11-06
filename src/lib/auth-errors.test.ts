import { describe, expect, it } from "vitest";
import { signInErrorMessage, signUpErrorMessage } from "./auth-errors.ts";

describe("signInErrorMessage", () => {
  it("explains when the username does not exist", () => {
    expect(
      signInErrorMessage(
        new Error("Uncaught Error: InvalidAccountId at retrieveAccount"),
      ),
    ).toBe("Username does not exist");
  });

  it("explains when the password is wrong", () => {
    expect(
      signInErrorMessage(
        new Error("Uncaught Error: InvalidSecret at retrieveAccount"),
      ),
    ).toBe("Wrong password");
  });

  it("does not expose stack traces for other sign-in errors", () => {
    expect(
      signInErrorMessage(
        new Error("Server Error Uncaught Error: Unexpected failure at handler"),
      ),
    ).toBe("Could not sign in");
    expect(signInErrorMessage("unexpected error")).toBe("Could not sign in");
  });
});

describe("signUpErrorMessage", () => {
  it("explains when the username is already registered", () => {
    expect(
      signUpErrorMessage(
        new Error("Uncaught Error: Account user@example.com already exists"),
      ),
    ).toBe("An account with this username already exists");
  });

  it("does not expose stack traces for other signup errors", () => {
    expect(
      signUpErrorMessage(
        new Error("Server Error Uncaught Error: Unexpected failure at handler"),
      ),
    ).toBe("Could not create account");
    expect(signUpErrorMessage("unexpected error")).toBe("Could not create account");
  });
});
