"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

type Theme = "light" | "dark";
/** Kullanıcının seçimi; "system" işletim sistemi temasını izler */
export type ThemeMode = Theme | "system";

type ThemeContextType = {
  /** Uygulanan tema */
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function subscribeSystemTheme(onChange: () => void) {
  const media = window.matchMedia(LIGHT_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const prefersLight = useSyncExternalStore(
    subscribeSystemTheme,
    () => window.matchMedia(LIGHT_QUERY).matches,
    () => false
  );
  const theme: Theme = mode === "system" ? (prefersLight ? "light" : "dark") : mode;

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial: ThemeMode = saved === "light" || saved === "dark" || saved === "system" ? saved : "dark";
    setModeState(initial);
  }, []);

  // İlk tema <head>'deki betikle uygulanır; burada yalnızca değişiklikler uygulanır
  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia(LIGHT_QUERY);
    const onChange = () => applyTheme(media.matches ? "light" : "dark");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem("theme", next);
    applyTheme(next === "system" ? (window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark") : next);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(theme === "dark" ? "light" : "dark");
  }, [theme, setMode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
