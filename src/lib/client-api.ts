/** Reads the "/en" or "/ar" segment the app router always prefixes routes with. */
function currentLocale(): string {
  if (typeof window === "undefined") return "en";
  const match = window.location.pathname.match(/^\/(en|ar)(?=\/|$)/);
  return match ? match[1] : "en";
}

/**
 * Browser fetch wrapper: tags every request with the active UI locale (so AI-generated
 * responses — chat answers, summaries — come back in the same language as the app),
 * and redirects to login on expired sessions (401).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const locale = currentLocale();
  const headers = new Headers(init?.headers);
  if (!headers.has("X-App-Locale")) headers.set("X-App-Locale", locale);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    const path = `${window.location.pathname}${window.location.search}`;
    const callback = encodeURIComponent(path || "/");
    const loginPath = locale === "en" ? "/en/login" : `/${locale}/login`;
    window.location.assign(`${loginPath}?callbackUrl=${callback}`);
    throw new Error("Session expired — redirecting to login");
  }
  return res;
}
