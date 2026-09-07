/**
 * Platform-admin gate.
 *
 * The /platform/* SaaS-admin pages are still rendered from `lib/mock/*` —
 * fabricated schools, audit rows, support tickets and integrations. Nothing in
 * there is real data, so the surface is gated twice:
 *
 *   1. ENABLE_PLATFORM_ADMIN — a build/deploy switch. Off by default, which
 *      means the route group is unreachable no matter who is signed in.
 *   2. PLATFORM_ADMIN_EMAILS — an exact-email allowlist, consulted only when
 *      the switch is on.
 *
 * Removing gate 1 is a deliberate step, not a config accident. Once these pages
 * are backed by real queries the flag can go away.
 *
 * Once a real PlatformAdmin model exists, swap the email check for it.
 */

import { getCurrentUser } from "@/lib/auth/current-user";
import { env } from "@/lib/env";

/** True only when the platform surface is switched on for this deployment. */
export function platformAdminEnabled(): boolean {
  return env.ENABLE_PLATFORM_ADMIN === true;
}

export async function isPlatformAdmin(): Promise<boolean> {
  if (!platformAdminEnabled()) return false;
  const user = await getCurrentUser();
  if (!user) return false;
  return isPlatformAdminEmail(user.email);
}

export function isPlatformAdminEmail(email: string): boolean {
  if (!platformAdminEnabled()) return false;
  return env.PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
