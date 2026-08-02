export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME: Theme = "dark";

/**
 * Runs before hydration (injected as a plain <script> from a Server Component)
 * to set the theme class ahead of paint and avoid a flash of the wrong theme.
 * Kept as a string (rather than relying on a client-rendered script tag) so it
 * never passes through React's client renderer — see theme-provider.tsx.
 */
export function themeInitScript(): string {
  return `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var r=t==="light"||t==="dark"?t:"${DEFAULT_THEME}";var d=document.documentElement;d.classList.remove("light","dark");d.classList.add(r);d.style.colorScheme=r;}catch(e){}})();`;
}
