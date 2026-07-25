import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { parseJsonBody } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { selfRegisterSchema } from "@/lib/validations";
import { sendSignupRequestToAdmins } from "@/lib/access-control";

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req);
    const parsed = selfRegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const supabase = getSupabaseAdmin();

    const { data: existing, error: lookupError } = await supabase
      .from("users")
      .select("id, status")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.status === "active") {
      throw new ApiError(
        409,
        "An account with this email already exists. Please sign in.",
        "already_registered",
      );
    }
    if (existing?.status === "invited") {
      throw new ApiError(
        409,
        "You already have an invite. Open the invite link from your email, or use Continue with Google.",
        "invited",
      );
    }
    if (existing?.status === "pending") {
      throw new ApiError(
        409,
        "Your access request is already pending admin approval.",
        "pending",
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    if (existing?.status === "rejected") {
      const { error } = await supabase
        .from("users")
        .update({
          name,
          password_hash: passwordHash,
          status: "pending",
          role: "assistant",
          requested_at: now,
          approved_at: null,
          approved_by: null,
          invite_token: null,
          invite_expires_at: null,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const id = randomUUID();
      const { error } = await supabase.from("users").insert({
        id,
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        role: "assistant",
        status: "pending",
        requested_at: now,
      });
      if (error) {
        if (error.code === "23505") {
          throw new ApiError(409, "Email already registered", "conflict");
        }
        throw error;
      }
    }

    const mail = await sendSignupRequestToAdmins({ name, email: normalizedEmail });

    return jsonOk({
      ok: true,
      message:
        "Request submitted. An admin will review your access. You will get an email when approved.",
      emailNotified: mail.sent,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
