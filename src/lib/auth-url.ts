/**
 * On Vercel, Auth.js must use the deployment URL — not localhost from .env.
 * Prefer AUTH_URL when it is a real public URL; otherwise derive from VERCEL_URL.
 */
export function resolveAuthUrl(): string | undefined {
  const explicit = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (explicit && !/localhost|127\.0\.0\.1/i.test(explicit)) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return explicit?.replace(/\/$/, "") || undefined;
}

/** Apply resolved URL onto process.env so Auth.js / next-auth pick it up. */
export function applyProductionAuthUrl(): void {
  const url = resolveAuthUrl();
  if (!url) return;
  process.env.AUTH_URL = url;
  process.env.NEXTAUTH_URL = url;
}
