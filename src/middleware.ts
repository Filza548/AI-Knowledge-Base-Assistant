import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { applySecurityHeaders } from "@/lib/security/headers";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/login", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!req.auth && !isPublic && !pathname.startsWith("/_next")) {
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

  if (req.auth && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  if (
    pathname.startsWith("/admin-settings") &&
    req.auth?.user?.role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return applySecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
