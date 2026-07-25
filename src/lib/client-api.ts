/**
 * Browser fetch wrapper: redirect to login on expired sessions (401).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    const path = `${window.location.pathname}${window.location.search}`;
    const callback = encodeURIComponent(path || "/");
    window.location.assign(`/login?callbackUrl=${callback}`);
    throw new Error("Session expired — redirecting to login");
  }
  return res;
}
