import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendAccessApprovedEmail } from "@/lib/access-control";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const session = await requireSession({
      roles: ["admin"],
      rateLimitKey: "admin-users-approve",
      limit: 40,
    });

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, name, email, role, status")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!user) throw new ApiError(404, "User not found", "not_found");
    if (user.status !== "pending" && user.status !== "rejected") {
      throw new ApiError(
        400,
        "Only pending (or rejected) requests can be approved",
        "invalid_status",
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: session.user.id,
        invite_token: null,
        invite_expires_at: null,
      })
      .eq("id", id)
      .select("id, name, email, role, status, created_at")
      .single();
    if (error) throw error;

    const mail = await sendAccessApprovedEmail({
      email: data.email,
      name: data.name,
    });

    return jsonOk({ user: data, emailSent: mail.sent });
  } catch (err) {
    return handleRouteError(err);
  }
}
