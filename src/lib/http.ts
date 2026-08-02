import { ApiError } from "@/lib/api";

/** Parse JSON body; malformed JSON becomes a 400 instead of an opaque 500. */
export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body", "invalid_json");
  }
}

/** The app's active UI locale, as tagged by client-api.ts's apiFetch on every request. */
export function getRequestLocale(req: Request): "en" | "ar" {
  return req.headers.get("X-App-Locale") === "ar" ? "ar" : "en";
}
