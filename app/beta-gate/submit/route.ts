/**
 * POST /beta-gate/submit
 *
 * Validates the submitted beta password against BETA_ACCESS_PASSWORD. On a
 * match, sets the access cookie (httpOnly) and redirects to `next`. On a
 * miss, bounces back to /beta-gate with an error flag.
 */

import { NextResponse, type NextRequest } from "next/server";

import { BETA_COOKIE, BETA_COOKIE_MAX_AGE, betaToken } from "@/lib/beta/gate";

export async function POST(request: NextRequest) {
  const expected = process.env.BETA_ACCESS_PASSWORD;
  // Gate disabled — nothing to validate, just go home.
  if (!expected) return NextResponse.redirect(new URL("/", request.url));

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const nextRaw = String(form.get("next") ?? "/");
  const next = nextRaw.startsWith("/") ? nextRaw : "/";

  if (password !== expected) {
    const back = new URL("/beta-gate", request.url);
    back.searchParams.set("error", "1");
    back.searchParams.set("next", next);
    return NextResponse.redirect(back, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set(BETA_COOKIE, betaToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BETA_COOKIE_MAX_AGE,
  });
  return response;
}
