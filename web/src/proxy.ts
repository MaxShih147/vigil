import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const path = req.nextUrl.pathname;

  // Public routes — no session required
  if (
    path.startsWith("/signin") ||
    path.startsWith("/request-access") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/devices") // Pi → API uses bearer token, not session
  ) {
    return NextResponse.next();
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl));
  }

  // Admin routes — admin only
  if (path.startsWith("/admin")) {
    const isAdmin = (req.auth.user as { isAdmin?: boolean } | undefined)?.isAdmin;
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals and static files (anything with a dot)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
