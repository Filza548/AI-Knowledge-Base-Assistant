import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
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
    return jsonError(err.status, err.message, err.code);
  }

  console.error("[api]", err);
  return jsonError(500, "Internal server error", "internal_error");
}
