"use client";
import * as React from "react";

export type Theme = "light" | "dark";
const KEY = "routezen-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try { if (localStorage.getItem(KEY) === "dark") return "dark"; } catch { /* storage unavailable */ }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function useTheme() {
  const theme = React.useSyncExternalStore<Theme>(subscribe, read, () => "light");
  const setTheme = React.useCallback((t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
    listeners.forEach((l) => l());
  }, []);
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

/** Inline script (runs before paint) to avoid a flash of the wrong theme. */
export const themeInitScript = `try{if(localStorage.getItem("${KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
