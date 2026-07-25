import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return applySecurityHeaders(NextResponse.json(data, { status }));
}

export function jsonError(
  status: number,
  message: string,
  code?: string,
  extra?: Record<string, unknown>,
) {
  return applySecurityHeaders(
    NextResponse.json(
      { error: message, code: code ?? "error", ...extra },
      { status },
    ),
  );
}

export function handleRouteError(err: unknown) {
  if (err instanceof ApiError) {
    const res = jsonError(err.status, err.message, err.code);
    if (err.headers) {
      for (const [key, value] of Object.entries(err.headers)) {
        res.headers.set(key, value);
      }
    }
    return res;
  }

  // Postgrest / Supabase errors are plain objects — log fields clearly
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    console.error("[api]", {
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
    });
  } else {
    console.error("[api]", err);
  }

  return jsonError(500, "Internal server error", "internal_error");
}
