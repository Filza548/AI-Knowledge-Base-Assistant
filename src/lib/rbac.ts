import type { UserRole } from "@/types";
import { ApiError } from "@/lib/api";

export function assertRole(
  role: UserRole | undefined,
  allowed: UserRole[],
): asserts role is UserRole {
  if (!role || !allowed.includes(role)) {
    throw new ApiError(403, "Forbidden", "forbidden");
  }
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === "admin";
}
