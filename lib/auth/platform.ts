/**
 * Platform-admin gate.
 *
 * The /platform/* SaaS-admin pages are still mock data and aren't part of
 * the beta's core-loop demo, so we keep them closed. A user counts as a
 * platform admin if their email is on the PLATFORM_ADMIN_EMAILS allowlist
 * OR ends with @riel.gg (the existing internal-staff convention used by
 * getViewer()).
 *
 * Once a real PlatformAdmin model exists, swap the email check for it.
 */

import { getCurrentUser } from "@/lib/auth/current-user";
import { env } from "@/lib/env";

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const email = user.email.toLowerCase();
  if (email.endsWith("@riel.gg")) return true;
  return env.PLATFORM_ADMIN_EMAILS.includes(email);
}
