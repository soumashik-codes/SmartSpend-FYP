import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // allow public pages
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public");

  if (isPublic) return NextResponse.next();

  // protect app routes
  const isAppRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/forecast") ||
    pathname.startsWith("/receipts") ||
    pathname.startsWith("/insights");

  if (isAppRoute) {
    const authCookie = request.cookies.get("smartspend-auth");

    if (!authCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Tell Next.js which routes this applies to
export const config = {
  matcher: ["/dashboard/:path*", "/forecast/:path*", "/receipts/:path*", "/insights/:path*", "/login", "/"],
};
