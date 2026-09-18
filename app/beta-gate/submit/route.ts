/**
 * POST /beta-gate/submit
 *
 * Validates the submitted beta password against BETA_ACCESS_PASSWORD. On a
 * match, sets the access cookie (httpOnly) and redirects to `next`. On a
 * miss, bounces back to /beta-gate with an error flag.
 */

import { NextResponse, type NextRequest } from "next/server";

import { BETA_COOKIE, BETA_COOKIE_MAX_AGE, betaToken } from "@/lib/beta/gate";
import { enforceBetaGateRateLimit } from "@/lib/security/public-rate-limit";
import { safeInternalPath } from "@/lib/security/redirect";

export async function POST(request: NextRequest) {
  const expected = process.env.BETA_ACCESS_PASSWORD;
  // Gate disabled — nothing to validate, just go home.
  if (!expected) return NextResponse.redirect(new URL("/", request.url));

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeInternalPath(String(form.get("next") ?? "/"));

  try {
    const rateLimit = await enforceBetaGateRateLimit(request.headers);
    if (rateLimit) return gateErrorRedirect(request, next, "rate-limit");
  } catch (error) {
    console.error("Beta-gate rate limit failed", error);
    return gateErrorRedirect(request, next, "unavailable");
  }

  if (password !== expected) {
    return gateErrorRedirect(request, next, "invalid");
  }

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set(BETA_COOKIE, await betaToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BETA_COOKIE_MAX_AGE,
  });
  return response;
}

function gateErrorRedirect(request: NextRequest, next: string, error: string) {
  const back = new URL("/beta-gate", request.url);
  back.searchParams.set("error", error);
  back.searchParams.set("next", next);
  return NextResponse.redirect(back, { status: 303 });
}
