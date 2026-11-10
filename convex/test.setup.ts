/// <reference types="vite/client" />
import { vi } from "vitest";

export const modules = import.meta.glob([
  "./**/*.{js,mjs,cjs,ts,tsx,mts,cts,jsx}",
  "!./**/*.*.*",
]);
