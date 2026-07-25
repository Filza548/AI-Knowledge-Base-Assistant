import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { applyProductionAuthUrl } from "@/lib/auth-url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  upsertSupabaseAuthUser,
  upsertSupabaseOAuthUser,
} from "@/lib/supabase/auth-users";
import { logActivity } from "@/lib/activity";
import type { UserRole } from "@/types";

applyProductionAuthUrl();

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

/** Lookup without password_hash — used by Google SSO when column may be optional. */
async function findAppUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Find or create an app profile for a Google sign-in (always assistant). */
async function ensureGoogleAppUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = input.email.toLowerCase().trim();
  const existing = await findAppUserByEmail(email);
  if (existing) {
    // Password/admin accounts keep their role; Google-only stay assistants
    if (existing.role === "assistant") return existing;

    const supabase = getSupabaseAdmin();
    const { data: withPassword } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", existing.id)
      .maybeSingle();

    if (withPassword?.password_hash) return existing;

    const { data, error } = await supabase
      .from("users")
      .update({ role: "assistant" })
      .eq("id", existing.id)
      .select("id, name, email, role")
      .single();
    if (error) throw error;
    return data;
  }

  const supabase = getSupabaseAdmin();
  const name =
    input.name?.trim() ||
    email.split("@")[0] ||
    "Google user";

  const { data, error } = await supabase
    .from("users")
    .insert({
      name,
      email,
      role: "assistant",
    })
    .select("id, name, email, role")
    .single();

  if (error) throw error;
  return data;
}

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

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
        try {
          const email = String(credentials?.email ?? "")
            .trim()
            .toLowerCase();
          const password = String(credentials?.password ?? "");

          if (!email || !password) return null;

          const user = await findUserByEmail(email);
          // Google-only accounts have no password_hash — must use Google button
          if (!user?.password_hash) {
            console.warn(
              "[auth] credentials login failed: user missing or no password",
              email,
            );
            return null;
          }

          const valid = await bcrypt.compare(password, user.password_hash);
          if (!valid) {
            console.warn("[auth] credentials login failed: bad password", email);
            return null;
          }

          // Mirror into Supabase Auth as admin (email/password)
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

          void logActivity({
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
            },
            action: "login_credentials",
            details: { login_method: "email" },
          });

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
          };
        } catch (err) {
          console.error("[auth] credentials authorize error:", err);
          return null;
        }
      },
    }),
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // Same email may later get a password account from admin
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role as UserRole;
        if (user.name) token.name = user.name;
      }

      // Keep role fresh from DB (e.g. after promoting Google users to admin)
      if (token.id) {
        try {
          const supabase = getSupabaseAdmin();
          const { data } = await supabase
            .from("users")
            .select("role, name")
            .eq("id", token.id as string)
            .maybeSingle();
          if (data?.role) token.role = data.role as UserRole;
          if (data?.name) token.name = data.name;
        } catch (err) {
          console.error("JWT role refresh failed:", err);
        }
      }

      return token;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "google") return false;
      if (!user.email) return false;

      try {
        const appUser = await ensureGoogleAppUser({
          email: user.email,
          name: user.name ?? profile?.name,
          image: user.image,
        });

        user.id = appUser.id;
        user.role = appUser.role as UserRole;
        user.name = appUser.name;

        try {
          await upsertSupabaseOAuthUser({
            id: appUser.id,
            email: appUser.email,
            name: appUser.name,
            role: appUser.role,
            image: user.image,
            provider: "google",
          });
        } catch (err) {
          console.error("Supabase Auth Google sync failed:", err);
        }

        void logActivity({
          user: {
            id: appUser.id,
            email: appUser.email,
            role: appUser.role,
          },
          action: "login_google",
          details: { login_method: "google", provider: "google" },
        });

        return true;
      } catch (err) {
        console.error(
          "Google sign-in failed:",
          err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : JSON.stringify(err),
        );
        return false;
      }
    },
  },
});
