import { NextResponse, type NextRequest } from "next/server";

import { updateSession, getSessionUser } from "@/lib/supabase/middleware";
import { BETA_COOKIE, betaToken } from "@/lib/beta/gate";

// Routes that require auth.
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/platform", "/me"];

// Routes that should redirect signed-in users away (auth-only pages).
const GUEST_ONLY = ["/login"];

// Paths that stay reachable even when the beta gate is locked — the gate
// itself, plus any asset path (already excluded by the matcher below).
const BETA_GATE_ALLOW = ["/beta-gate"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // --- Beta access gate -------------------------------------------------
  // Read at request time (not module load) so toggling the env var doesn't
  // require a rebuild. When set, lock everything behind /beta-gate until the
  // visitor presents a cookie matching the password token.
  const betaPassword = process.env.BETA_ACCESS_PASSWORD;
  if (betaPassword) {
    const allowed = BETA_GATE_ALLOW.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!allowed) {
      const cookie = request.cookies.get(BETA_COOKIE)?.value;
      if (cookie !== betaToken(betaPassword)) {
        const gate = new URL("/beta-gate", request.url);
        gate.searchParams.set("next", pathname + request.nextUrl.search);
        return NextResponse.redirect(gate);
      }
    }
  }

  // Always refresh the Supabase session cookies.
  const sessionResponse = await updateSession(request);

  const protectedPath = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const guestOnlyPath = GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!protectedPath && !guestOnlyPath) return sessionResponse;

  const user = await getSessionUser(request);

  if (protectedPath && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (guestOnlyPath && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return sessionResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
