import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    await requireSession({
      roles: ["admin"],
      rateLimitKey: "admin-users-reject",
      limit: 40,
    });

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!user) throw new ApiError(404, "User not found", "not_found");
    if (user.status !== "pending" && user.status !== "invited") {
      throw new ApiError(
        400,
        "Only pending requests or open invites can be rejected",
        "invalid_status",
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        status: "rejected",
        invite_token: null,
        invite_expires_at: null,
        approved_at: null,
        approved_by: null,
      })
      .eq("id", id)
      .select("id, name, email, role, status, created_at")
      .single();
    if (error) throw error;

    return jsonOk({ user: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
