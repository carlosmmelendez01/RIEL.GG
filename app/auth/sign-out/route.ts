import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

// Allow GET for convenience (e.g. clicking a sign-out link in email).
// In production you'd usually require POST + CSRF; we'll harden later.
export async function GET(request: NextRequest) {
  return POST(request);
}
