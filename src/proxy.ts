import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { authConfig } from "@/auth.config";
import { applySecurityHeaders } from "@/lib/security/headers";
import { routing } from "@/i18n/routing";

const { auth } = NextAuth(authConfig);
const intlMiddleware = createIntlMiddleware(routing);

/** Split a leading locale segment ("/en" or "/ar") from the rest of the app path. */
function bareAndPrefix(pathname: string) {
  const match = pathname.match(/^\/(en|ar)(?=\/|$)/);
  if (!match) return { bare: pathname, prefix: `/${routing.defaultLocale}` };
  const bare = pathname.slice(match[0].length) || "/";
  return { bare, prefix: `/${match[1]}` };
}

function isPublicApi(pathname: string) {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/register") ||
    pathname.startsWith("/api/invite")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return applySecurityHeaders(NextResponse.next());
    }
    if (!req.auth) {
      const res = NextResponse.json(
        { error: "Unauthorized", code: "unauthorized" },
        { status: 401 },
      );
      return applySecurityHeaders(res);
    }
    return applySecurityHeaders(NextResponse.next());
  }

  const { bare, prefix } = bareAndPrefix(pathname);
  const isPublicPage = bare === "/login" || bare === "/signup";

  if (!req.auth && !isPublicPage) {
    const url = new URL(`${prefix}/login`, req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  if (bare.startsWith("/admin-settings") && user?.role !== "admin") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(`${prefix}/dashboard`, req.nextUrl.origin)),
    );
  }

  return applySecurityHeaders(intlMiddleware(req));
});

// Exclude Auth.js routes so the auth() wrapper cannot 404 them.
// /login and /signup stay covered so next-intl can still resolve their locale.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
