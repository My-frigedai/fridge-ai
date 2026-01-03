// app/components/ThemeProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  theme: "light" | "dark";
  rawTheme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [rawTheme, setRawTheme] = useState<ThemeMode>("system");
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      root.setAttribute("data-theme", mode);
    }
  };

  useEffect(() => {
    const saved =
      (localStorage.getItem("theme") as ThemeMode | null) || "system";
    setRawTheme(saved);

    const getEffectiveTheme = (mode: ThemeMode): "light" | "dark" => {
      if (mode === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return mode;
    };

    setThemeState(getEffectiveTheme(saved));
    applyTheme(saved);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (saved === "system") setThemeState(getEffectiveTheme("system"));
    };
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setRawTheme(mode);
    localStorage.setItem("theme", mode);
    const getEffectiveTheme = (mode: ThemeMode): "light" | "dark" => {
      if (mode === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return mode;
    };
    setThemeState(getEffectiveTheme(mode));
    applyTheme(mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, rawTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
