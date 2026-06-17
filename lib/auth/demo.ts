import "server-only";

import { env } from "@/lib/env";

export function demoAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    env.ENABLE_DEMO_AUTH &&
    Boolean(env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(env.DEMO_AUTH_PASSWORD) &&
    env.DEMO_AUTH_EMAILS.length > 0
  );
}

export function isAllowedDemoEmail(email: string): boolean {
  return env.DEMO_AUTH_EMAILS.includes(email.trim().toLowerCase());
}
