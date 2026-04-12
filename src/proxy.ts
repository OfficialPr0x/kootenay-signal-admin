import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "fallback-secret");

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and API login route
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/setup") {
    return NextResponse.next();
  }

  // Check auth token
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
