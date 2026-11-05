import { describe, expect, it } from "vitest";
import { validatePasswordRequirements } from "./password";

describe("password requirements", () => {
  it("accepts passwords at the 12 and 20 character boundaries", () => {
    expect(() => validatePasswordRequirements("Good-Pas1A!?")).not.toThrow();
    expect(() =>
      validatePasswordRequirements("Abcdefghijklmno1!XYZ"),
    ).not.toThrow();
  });

  it.each([
    ["too short", "Good-Pas1A!?".slice(0, 11)],
    ["too long", "Abcdefghijklmno1!XYZQ"],
    ["missing uppercase", "good-pass123!"],
    ["missing lowercase", "GOOD-PASS123!"],
    ["missing digit", "Good-PassWord!"],
    ["missing special character", "GoodPassword1"],
    ["only whitespace as the special character", "Good Pass123"],
  ])("rejects passwords that are %s", (_reason, password) => {
    expect(() => validatePasswordRequirements(password)).toThrow(
      /12-20 characters.*uppercase.*lowercase.*special character.*digit/,
    );
  });
});
