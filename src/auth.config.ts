import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types";

/** Edge-safe Auth.js config (no Node-only imports). Used by middleware. */
export const authConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 15 * 60,
    updateAge: 5 * 60,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
