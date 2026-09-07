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
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
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

  // 3. Sign in with password using a route-local SSR client. We capture the
  //    auth cookies Supabase wants to set, then attach them directly to the
  //    redirect response below. This is more reliable in local dev than
  //    relying on the implicit next/headers cookie store across redirects.
  const authCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        authCookies.push(...cookiesToSet);
      },
    },
  });

  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: demoPassword,
  });

  if (signInErr) {
    return NextResponse.json(
      { error: `signInWithPassword: ${signInErr.message}` },
      { status: 500 },
    );
  }

  // 4. Bridge the seeded User row + resolve role-based landing. We do this
  //    from the returned auth user instead of reading cookies again inside
  //    the same route handler; the browser has not received them yet.
  const authUser = signInData.user;
  const authEmail = authUser?.email?.toLowerCase() ?? email;

  let user = authUser?.id
    ? await prisma.user.findUnique({ where: { authId: authUser.id } })
    : null;

  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email: authEmail } });
    if (existing && authUser?.id) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          authId: authUser.id,
          fullName:
            (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
            existing.fullName,
          avatarUrl:
            (authUser.user_metadata?.avatar_url as string | undefined) ?? existing.avatarUrl,
        },
      });
    } else {
      user = existing;
    }
  }

  if (!user && authUser?.id) {
    user = await prisma.user.create({
      data: {
        authId: authUser.id,
        email: authEmail,
        fullName:
          (authUser.user_metadata?.full_name as string | undefined) || authEmail.split("@")[0],
        avatarUrl: authUser.user_metadata?.avatar_url as string | undefined,
      },
    });
  }

  const defaultNext = user ? await getPrimaryLanding(user.id, user.email) : "/me";
  const next = safeInternalPath(explicitNext, defaultNext);

  // 5. Redirect to the target page. Attach the cookies to this exact response
  //    so the next page sees a real session immediately.
  const response = NextResponse.redirect(new URL(next, request.url));
  for (const { name, value, options } of authCookies) {
    response.cookies.set(name, value, { ...options, path: options.path ?? "/" });
  }
  return response;
}
