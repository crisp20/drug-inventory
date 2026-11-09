import { useEffect, useState } from "react";
import { ThemeContext, type Theme } from "./theme-context.ts";

function storedTheme(): Theme {
  try {
    const theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark" || theme === "system") {
      return theme;
    }
  } catch {
    // Theme preference is optional when storage is unavailable.
  }
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState(storedTheme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.classList.toggle("light", resolvedTheme === "light");
      root.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    if (theme !== "system") return;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}
