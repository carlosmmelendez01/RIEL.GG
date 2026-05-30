/**
 * Supabase Auth callback.
 *
 * After Google/Microsoft OAuth or a magic-link click, the user is redirected
 * here with a `code` query param. We exchange that for a session, then run our
 * "bridge to seeded user" logic via getCurrentUser() (it has the bridging
 * built in), then redirect onward.
 */

import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrimaryLanding } from "@/lib/auth/landing";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const explicitNext = url.searchParams.get("next");

  if (!code) {
    // Magic link sometimes uses a token_hash instead — Supabase JS client
    // handles that automatically on the /login page, but if we got here
    // with no code, just send them back to /login.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errUrl = new URL("/login", request.url);
    errUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(errUrl);
  }

  // Trigger user bridging — adopts a seeded User row if email matches,
  // otherwise creates a fresh User row.
  const user = await getCurrentUser();

  // Prefer an explicit ?next= override (e.g., from a deep-link). Otherwise
  // route by role: admin → /admin, coach → /dashboard, player → /me.
  const next = explicitNext ?? (user ? await getPrimaryLanding(user.id, user.email) : "/me");

  return NextResponse.redirect(new URL(next, request.url));
}
