import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type UpsertAuthUserInput = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
};

/**
 * Create or update a user in Supabase Auth (Authentication → Users),
 * keeping the same UUID as public.users.
 */
export async function upsertSupabaseAuthUser(
  input: UpsertAuthUserInput,
  client?: SupabaseClient,
): Promise<User> {
  const supabase = client ?? getSupabaseAdmin();
  const email = input.email.toLowerCase().trim();

  const { data: existingById, error: getError } =
    await supabase.auth.admin.getUserById(input.id);

  // getUserById returns error when user is missing — treat as "not found"
  if (!getError && existingById.user) {
    const { data, error } = await supabase.auth.admin.updateUserById(input.id, {
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        name: input.name,
        role: input.role,
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Failed to update Supabase Auth user");
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    id: input.id,
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: input.role,
    },
  });

  if (!error && data.user) return data.user;

  // Email may already exist under a different id — update that account instead
  const existing = await findAuthUserByEmail(supabase, email);
  if (existing) {
    const { data: updated, error: updateError } =
      await supabase.auth.admin.updateUserById(existing.id, {
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          role: input.role,
          app_user_id: input.id,
        },
      });
    if (updateError) throw updateError;
    if (!updated.user) throw new Error("Failed to update Supabase Auth user");
    return updated.user;
  }

  throw error ?? new Error("Failed to create Supabase Auth user");
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<User | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}
