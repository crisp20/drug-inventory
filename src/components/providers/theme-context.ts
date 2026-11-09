import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";

export const ThemeContext = createContext<Theme>("system");

export function useTheme() {
  return { theme: useContext(ThemeContext) };
}
