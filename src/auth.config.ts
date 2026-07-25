import type { NextAuthConfig } from "next-auth";
import type { UserRole, UserStatus } from "@/types";
import { applyProductionAuthUrl } from "@/lib/auth-url";

applyProductionAuthUrl();

/** Edge-safe Auth.js config (no Node-only imports). Used by proxy. */
export const authConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 30 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role as UserRole;
        token.status = (user.status as UserStatus) ?? "active";
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
  },
} satisfies NextAuthConfig;
