import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico");

  if (isPublic) return NextResponse.next();

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/forecast") ||
    pathname.startsWith("/receipts") ||
    pathname.startsWith("/insights");

  if (isProtected) {
    const token = request.cookies.get("access_token");

    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/forecast/:path*", "/receipts/:path*", "/insights/:path*"],
};
