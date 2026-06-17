/**
 * Demo sign-in bypass.
 *
 * GET /dev/sign-in?email=<email>
 *
 * 1. Refuse in production and unless local demo auth is fully configured.
 * 2. Use the service-role admin client to ensure auth.users has a row for the
 *    target email with a known demo password (creates it if missing, resets
 *    the password if it exists).
 * 3. Call supabase.auth.signInWithPassword from the SSR client — this writes
 *    the session cookies directly. No magic link, no email, no OTP.
 * 4. Redirect to the next URL (default role-based landing).
 *
 * Why password instead of magic link: Supabase rate-limits OTP generation
 * (30/hour on free tier) even when called via the admin generateLink API.
 * Password sign-in is not subject to that limit, so this works even after
 * we've blown through the magic-link cap.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrimaryLanding } from "@/lib/auth/landing";
import { demoAuthEnabled, isAllowedDemoEmail } from "@/lib/auth/demo";
import { safeInternalPath } from "@/lib/security/redirect";

export async function GET(request: NextRequest) {
  if (!demoAuthEnabled()) {
    return new NextResponse("Demo sign-in is disabled.", { status: 403 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const explicitNext = url.searchParams.get("next");

  if (!email) {
    return NextResponse.json({ error: "email param required" }, { status: 400 });
  }
  if (!isAllowedDemoEmail(email)) {
    return new NextResponse("That account is not enabled for local demo access.", { status: 403 });
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set in env" },
      { status: 500 },
    );
  }

  // Service-role admin client. Never use this from the browser.
  const admin = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Look up by email. listUsers is paginated; we have <50 dev users so a
  //    single page is fine.
  const { data: usersList, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    return NextResponse.json({ error: `listUsers: ${listErr.message}` }, { status: 500 });
  }

  const existing = usersList.users.find((u) => u.email?.toLowerCase() === email);

  const demoPassword = env.DEMO_AUTH_PASSWORD;
  if (!demoPassword) {
    return NextResponse.json({ error: "Demo password not configured" }, { status: 500 });
  }

  // 2. Ensure the allowlisted local demo user exists with the configured password.
  if (existing) {
    const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: demoPassword,
      email_confirm: true,
    });
    if (updateErr) {
      return NextResponse.json(
        { error: `updateUserById: ${updateErr.message}` },
        { status: 500 },
      );
    }
  } else {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password: demoPassword,
      email_confirm: true,
    });
    if (createErr) {
      return NextResponse.json({ error: `createUser: ${createErr.message}` }, { status: 500 });
    }
  }

  // 3. Sign in with password using the SSR client. This writes the auth
  //    cookies onto the response automatically (createClient wires up the
  //    next/headers cookie store).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: demoPassword,
  });

  if (signInErr) {
    return NextResponse.json(
      { error: `signInWithPassword: ${signInErr.message}` },
      { status: 500 },
    );
  }

  // 4. Bridge the seeded User row + resolve role-based landing. We still
  //    honor an explicit ?next= for deep links.
  const user = await getCurrentUser();
  const defaultNext = user ? await getPrimaryLanding(user.id, user.email) : "/me";
  const next = safeInternalPath(explicitNext, defaultNext);

  // 5. Redirect to the target page. The cookies set above will travel with
  //    the redirect, so the next page sees a real session.
  return NextResponse.redirect(new URL(next, request.url));
}
