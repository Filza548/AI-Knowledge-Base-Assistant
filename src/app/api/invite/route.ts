import bcrypt from "bcryptjs";
import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { parseJsonBody } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { upsertSupabaseAuthUser } from "@/lib/supabase/auth-users";
import { acceptInviteSchema } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token")?.trim();
    if (!token) {
      throw new ApiError(400, "Invite token required", "validation_error");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, status, invite_expires_at, role")
      .eq("invite_token", token)
      .maybeSingle();
    if (error) throw error;

    if (!data || data.status !== "invited") {
      throw new ApiError(404, "Invite not found or already used", "not_found");
    }
    if (
      data.invite_expires_at &&
      new Date(data.invite_expires_at).getTime() < Date.now()
    ) {
      throw new ApiError(410, "This invite has expired. Ask an admin to resend.", "expired");
    }

    return jsonOk({
      invite: {
        name: data.name,
        email: data.email,
        role: data.role,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req);
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const { token, password, name } = parsed.data;
    const supabase = getSupabaseAdmin();
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, name, email, role, status, invite_expires_at")
      .eq("invite_token", token)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (!user || user.status !== "invited") {
      throw new ApiError(404, "Invite not found or already used", "not_found");
    }
    if (
      user.invite_expires_at &&
      new Date(user.invite_expires_at).getTime() < Date.now()
    ) {
      throw new ApiError(410, "This invite has expired. Ask an admin to resend.", "expired");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const displayName = name?.trim() || user.name;

    const { data: updated, error } = await supabase
      .from("users")
      .update({
        name: displayName,
        password_hash: passwordHash,
        status: "active",
        approved_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
      })
      .eq("id", user.id)
      .select("id, name, email, role, status")
      .single();
    if (error) throw error;

    try {
      await upsertSupabaseAuthUser({
        id: updated.id,
        email: updated.email,
        password,
        name: updated.name,
        role: updated.role,
      });
    } catch (err) {
      console.error("Supabase Auth sync after invite accept failed:", err);
    }

    return jsonOk({
      ok: true,
      message: "Invite accepted. You can sign in now.",
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
