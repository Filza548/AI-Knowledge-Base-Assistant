import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  // Both locales are always prefixed ("/en/dashboard", "/ar/dashboard"). "as-needed"
  // (unprefixed default locale) triggers an internal rewrite that collides with
  // NextAuth's proxy wrapper and causes a redirect loop on the default locale.
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
