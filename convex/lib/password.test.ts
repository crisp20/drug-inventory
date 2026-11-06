import { describe, expect, it } from "vitest";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, validatePasswordRequirements } from "./password";

describe("password requirements", () => {
  it(`accepts passwords at the ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} character boundaries`, () => {
    expect(() => validatePasswordRequirements("Good-1!?")).not.toThrow();
    expect(() =>
      validatePasswordRequirements("Abcdefghijklmno1!XYZ"),
    ).not.toThrow();
  });

  it.each([
    ["too short", "Good-1!?".slice(0, MIN_PASSWORD_LENGTH - 1)],
    ["too long", "Abcdefghijklmno1!XYZQ"],
    ["missing uppercase", "good-pass123!"],
    ["missing lowercase", "GOOD-PASS123!"],
    ["missing digit", "Good-PassWord!"],
    ["missing special character", "GoodPassword1"],
    ["only whitespace as the special character", "Good Pass123"],
  ])("rejects passwords that are %s", (_reason, password) => {
    expect(() => validatePasswordRequirements(password)).toThrow(
      /8-20 characters.*uppercase.*lowercase.*special character.*digit/,
    );
  });
});
