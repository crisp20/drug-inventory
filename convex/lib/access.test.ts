import { afterEach, describe, expect, it, vi } from "vitest";
import { isOwnerEmail, parseOwnerEmails } from "./access";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseOwnerEmails", () => {
  it("splits on commas, semicolons and spaces and lower-cases", () => {
    expect(parseOwnerEmails(" A@x.com, b@x.com;c@x.com  d@x.com ")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("returns no owners when the secret is missing or blank", () => {
    expect(parseOwnerEmails(undefined)).toEqual([]);
    expect(parseOwnerEmails(" , ")).toEqual([]);
  });
});

describe("isOwnerEmail", () => {
  it("matches any listed owner, ignoring case and spaces", () => {
    vi.stubEnv("OWNER_EMAILS", "admin@acp.com, Boss@acp.com");
    expect(isOwnerEmail(" BOSS@acp.com ")).toBe(true);
    expect(isOwnerEmail("admin@acp.com")).toBe(true);
    expect(isOwnerEmail("staff@acp.com")).toBe(false);
  });

  it("makes nobody an owner when the secret is not set", () => {
    vi.stubEnv("OWNER_EMAILS", undefined);
    expect(isOwnerEmail("hubert@activecaregroup.com")).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });
});
