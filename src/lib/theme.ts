import type { Theme } from "./types";

const KEY = "pcbridge.theme";

export function readTheme(): Theme {
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "system";
}

/**
 * `system` niteliği hiç yazmaz — tokens.css'teki
 * `@media (prefers-color-scheme: light)` bloğu devreye girsin diye.
 */
export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  localStorage.setItem(KEY, t);
}
