import bcrypt from "bcryptjs";
import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { parseJsonBody } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { upsertSupabaseAuthUser } from "@/lib/supabase/auth-users";
import { updateProfileSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await requireSession({ rateLimitKey: "account-get" });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, status, password_hash")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "User not found", "not_found");

    return jsonOk({
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        hasPassword: Boolean(data.password_hash),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession({
      rateLimitKey: "account-update",
      limit: 20,
    });

    const body = await parseJsonBody(req);
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const { name, currentPassword, newPassword } = parsed.data;
    const supabase = getSupabaseAdmin();
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, name, email, role, status, password_hash")
      .eq("id", session.user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!user) throw new ApiError(404, "User not found", "not_found");
    if (user.status !== "active") {
      throw new ApiError(403, "Account is not active", "inactive");
    }

    const updates: Record<string, string> = {};

    if (name !== undefined && name !== user.name) {
      updates.name = name;
    }

    if (newPassword) {
      if (user.password_hash) {
        if (!currentPassword) {
          throw new ApiError(
            400,
            "Current password is required to set a new password",
            "current_password_required",
          );
        }
        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) {
          throw new ApiError(400, "Current password is incorrect", "bad_password");
        }
      }
      updates.password_hash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return jsonOk({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          hasPassword: Boolean(user.password_hash),
        },
        message: "Nothing to update",
      });
    }

    const { data: updated, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id)
      .select("id, name, email, role, password_hash")
      .single();
    if (error) throw error;

    if (newPassword) {
      try {
        await upsertSupabaseAuthUser({
          id: updated.id,
          email: updated.email,
          password: newPassword,
          name: updated.name,
          role: updated.role,
        });
      } catch (err) {
        console.error("Supabase Auth sync after profile update failed:", err);
      }
    }

    return jsonOk({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        hasPassword: Boolean(updated.password_hash),
      },
      message: "Profile updated",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
