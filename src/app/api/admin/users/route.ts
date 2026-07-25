import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { parseJsonBody } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { inviteUserSchema } from "@/lib/validations";
import {
  inviteExpiresAt,
  newInviteToken,
  sendInviteEmail,
} from "@/lib/access-control";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { upsertSupabaseAuthUser } from "@/lib/supabase/auth-users";
import { registerUserSchema } from "@/lib/validations";

export async function GET() {
  try {
    await requireSession({ roles: ["admin"], rateLimitKey: "admin-users-list" });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, name, email, role, status, created_at, requested_at, approved_at, invite_expires_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return jsonOk({ users: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Legacy: create active user with password immediately.
 * Prefer POST /api/admin/users/invite for company invite flow.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession({
      roles: ["admin"],
      rateLimitKey: "admin-users-create",
      limit: 10,
    });

    const body = await parseJsonBody(req);
    // Invite-shaped body (no password) → invite flow
    if (body && typeof body === "object" && !("password" in body)) {
      const parsed = inviteUserSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(
          400,
          parsed.error.issues[0]?.message ?? "Invalid input",
          "validation_error",
        );
      }
      const { name, email, role } = parsed.data;
      const normalizedEmail = email.toLowerCase();
      const supabase = getSupabaseAdmin();
      const token = newInviteToken();
      const expires = inviteExpiresAt(14);

      const { data: existing, error: lookupError } = await supabase
        .from("users")
        .select("id, status")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing?.status === "active") {
        throw new ApiError(409, "User already has access", "conflict");
      }

      if (existing) {
        const { data, error } = await supabase
          .from("users")
          .update({
            name,
            role,
            status: "invited",
            invite_token: token,
            invite_expires_at: expires,
            invited_by: session.user.id,
            password_hash: null,
            requested_at: null,
            approved_at: null,
            approved_by: null,
          })
          .eq("id", existing.id)
          .select("id, name, email, role, status, created_at")
          .single();
        if (error) throw error;
        const mail = await sendInviteEmail({
          email: normalizedEmail,
          name,
          token,
        });
        return jsonOk({
          user: data,
          inviteUrl: mail.inviteUrl,
          emailSent: mail.sent,
          emailReason: mail.reason,
        });
      }

      const id = randomUUID();
      const { data, error } = await supabase
        .from("users")
        .insert({
          id,
          name,
          email: normalizedEmail,
          role,
          status: "invited",
          invite_token: token,
          invite_expires_at: expires,
          invited_by: session.user.id,
        })
        .select("id, name, email, role, status, created_at")
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new ApiError(409, "Email already registered", "conflict");
        }
        throw error;
      }
      const mail = await sendInviteEmail({
        email: normalizedEmail,
        name,
        token,
      });
      return jsonOk(
        {
          user: data,
          inviteUrl: mail.inviteUrl,
          emailSent: mail.sent,
          emailReason: mail.reason,
        },
        201,
      );
    }

    const parsed = registerUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const { name, email, password, role } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const supabase = getSupabaseAdmin();
    const id = randomUUID();
    const normalizedEmail = email.toLowerCase();

    await upsertSupabaseAuthUser({
      id,
      email: normalizedEmail,
      password,
      name,
      role,
    });

    const { data, error } = await supabase
      .from("users")
      .insert({
        id,
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        role,
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: session.user.id,
      })
      .select("id, name, email, role, status, created_at")
      .single();

    if (error) {
      await supabase.auth.admin.deleteUser(id).catch(() => undefined);
      if (error.code === "23505") {
        throw new ApiError(409, "Email already registered", "conflict");
      }
      throw error;
    }

    return jsonOk({ user: data }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
