/// <reference types="vite/client" />
import { vi } from "vitest";

// Tests sign in as this owner; real deployments set OWNER_EMAILS in Secrets
vi.stubEnv("OWNER_EMAILS", "hubert@activecaregroup.com");

export const modules = import.meta.glob([
  "./**/*.{js,mjs,cjs,ts,tsx,mts,cts,jsx}",
  "!./**/*.*.*",
]);
