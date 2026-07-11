import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { upsertSupabaseAuthUser } from "@/lib/supabase/auth-users";
import { registerUserSchema } from "@/lib/validations";

export async function GET() {
  try {
    await requireSession({ roles: ["admin"], rateLimitKey: "admin-users-list" });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return jsonOk({ users: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireSession({
      roles: ["admin"],
      rateLimitKey: "admin-users-create",
      limit: 10,
    });

    const body = await req.json();
    const parsed = registerUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid input", "validation_error");
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
      })
      .select("id, name, email, role, created_at")
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
