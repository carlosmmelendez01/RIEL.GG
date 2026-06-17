/**
 * Platform-admin gate.
 *
 * The /platform/* SaaS-admin pages are still mock data and aren't part of
 * the beta's core-loop demo, so we keep them closed. A user counts as a
 * platform admin only when their exact email is on PLATFORM_ADMIN_EMAILS.
 *
 * Once a real PlatformAdmin model exists, swap the email check for it.
 */

import { getCurrentUser } from "@/lib/auth/current-user";
import { env } from "@/lib/env";

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return isPlatformAdminEmail(user.email);
}

export function isPlatformAdminEmail(email: string): boolean {
  return env.PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
