// app/components/ThemeProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");

  // apply theme to <html data-theme="...">
  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      root.setAttribute("data-theme", mode);
    }
  };

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as ThemeMode | null) || "system";
    setThemeState(saved);
    applyTheme(saved);

    // watch OS change if system mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (saved === "system") applyTheme("system");
    };
    // modern API
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem("theme", mode);
    applyTheme(mode);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
