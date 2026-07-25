import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { applySecurityHeaders } from "@/lib/security/headers";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const isAuthed = Boolean(user?.id);

  if (!isAuthed) {
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json(
        { error: "Unauthorized", code: "unauthorized" },
        { status: 401 },
      );
      return applySecurityHeaders(res);
    }

    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/admin-settings") &&
    user?.role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return applySecurityHeaders(NextResponse.next());
});

// Public: login, signup, Auth.js, register + accept-invite APIs
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|signup|api/auth|api/register|api/invite|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
