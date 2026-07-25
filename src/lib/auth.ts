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
import type { UserRole, UserStatus } from "@/types";

applyProductionAuthUrl();

type AppUserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: string;
  status: UserStatus;
};

async function findUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, password_hash, role, status")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data as AppUserRow | null;
}

/**
 * Google is closed enrollment:
 * - active → allow
 * - invited → activate on first Google login
 * - pending / rejected / unknown → deny
 */
async function resolveGoogleAppUser(input: {
  email: string;
  name?: string | null;
}) {
  const email = input.email.toLowerCase().trim();
  const existing = await findUserByEmail(email);

  if (!existing) {
    return { ok: false as const, reason: "not_invited" };
  }

  if (existing.status === "pending") {
    return { ok: false as const, reason: "pending" };
  }
  if (existing.status === "rejected") {
    return { ok: false as const, reason: "rejected" };
  }

  if (existing.status === "invited") {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .update({
        status: "active",
        approved_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
        name: input.name?.trim() || existing.name,
      })
      .eq("id", existing.id)
      .select("id, name, email, role, status")
      .single();
    if (error) throw error;
    return {
      ok: true as const,
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        status: data.status as UserStatus,
      },
    };
  }

  if (existing.status !== "active") {
    return { ok: false as const, reason: "inactive" };
  }

  return {
    ok: true as const,
    user: {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      role: existing.role as UserRole,
      status: existing.status,
    },
  };
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
          if (!user?.password_hash) {
            console.warn(
              "[auth] credentials login failed: user missing or no password",
              email,
            );
            return null;
          }

          if (user.status !== "active") {
            console.warn(
              "[auth] credentials login blocked: status=",
              user.status,
              email,
            );
            return null;
          }

          const valid = await bcrypt.compare(password, user.password_hash);
          if (!valid) {
            console.warn("[auth] credentials login failed: bad password", email);
            return null;
          }

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
            status: user.status,
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
        token.status = (user.status as UserStatus) ?? "active";
        if (user.name) token.name = user.name;
        delete token.error;
      }

      if (token.id) {
        try {
          const supabase = getSupabaseAdmin();
          const { data } = await supabase
            .from("users")
            .select("role, name, status")
            .eq("id", token.id as string)
            .maybeSingle();

          if (!data || data.status !== "active") {
            token.error = "inactive";
            return token;
          }

          delete token.error;
          token.role = data.role as UserRole;
          token.status = data.status as UserStatus;
          if (data.name) token.name = data.name;
        } catch (err) {
          console.error("JWT role refresh failed:", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error === "inactive" || !token.id) {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.status = (token.status as UserStatus) ?? "active";
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "google") return false;
      if (!user.email) return false;

      try {
        const resolved = await resolveGoogleAppUser({
          email: user.email,
          name: user.name ?? profile?.name,
        });

        if (!resolved.ok) {
          console.warn("[auth] Google denied:", resolved.reason, user.email);
          return false;
        }

        const appUser = resolved.user;
        user.id = appUser.id;
        user.role = appUser.role;
        user.name = appUser.name;
        user.status = appUser.status;

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
