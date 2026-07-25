import { randomUUID } from "crypto";
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

export async function POST(req: Request) {
  try {
    const session = await requireSession({
      roles: ["admin"],
      rateLimitKey: "admin-users-invite",
      limit: 30,
    });

    const body = await parseJsonBody(req);
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

    let userId: string;

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
      userId = data.id;

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

    userId = randomUUID();
    const { data, error } = await supabase
      .from("users")
      .insert({
        id: userId,
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
  } catch (err) {
    return handleRouteError(err);
  }
}
