import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import type { UserRole } from "@/types";

export async function requireSession(opts?: {
  roles?: UserRole[];
  rateLimitKey?: string;
  limit?: number;
  windowMs?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError(401, "Unauthorized", "unauthorized");
  }

  if (opts?.roles && !opts.roles.includes(session.user.role)) {
    throw new ApiError(403, "Forbidden", "forbidden");
  }

  if (opts?.rateLimitKey) {
    const key = `${opts.rateLimitKey}:${session.user.id}`;
    const result = rateLimit(
      key,
      opts.limit ?? 30,
      opts.windowMs ?? 60_000,
    );
    if (!result.ok) {
      throw new ApiError(429, "Too many requests. Try again shortly.", "rate_limited", {
        "Retry-After": String(Math.max(1, result.retryAfterSec)),
      });
    }
  }

  return session;
}
