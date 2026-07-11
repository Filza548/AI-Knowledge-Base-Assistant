import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { upsertSupabaseAuthUser } from "@/lib/supabase/auth-users";
import type { UserRole } from "@/types";

async function findUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, password_hash, role")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        const user = await findUserByEmail(email);
        if (!user?.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        // Mirror into Supabase Auth so the user appears under Authentication → Users
        try {
          await upsertSupabaseAuthUser({
            id: user.id,
            email: user.email,
            password,
            name: user.name,
            role: user.role,
          });
        } catch (err) {
          console.error("Supabase Auth sync failed:", err);
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;
      if (!user.email) return false;

      const existing = await findUserByEmail(user.email);
      if (!existing) return false;

      user.id = existing.id;
      user.role = existing.role as UserRole;
      user.name = existing.name;
      return true;
    },
  },
});
