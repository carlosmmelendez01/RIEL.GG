import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Beta / demo controls ---------------------------------------------
  // When "true", the one-click demo sign-in (/dev) works even in production.
  // Leave unset/false for a locked-down prod.
  ENABLE_DEMO_AUTH: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Shared password for the beta access gate. When set, every route is
  // locked behind /beta-gate until the visitor enters it. Unset = open.
  BETA_ACCESS_PASSWORD: z.string().optional(),
  // Where in-app feedback is delivered. Falls back to RESEND_FROM_ADDRESS's
  // implied inbox if unset; we just won't email if neither is configured.
  FEEDBACK_EMAIL: z.string().email().optional(),
  // Comma-separated allowlist of emails permitted into /platform/*. The
  // platform pages are still mock data, so we keep them closed by default.
  PLATFORM_ADMIN_EMAILS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://placeholder.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("placeholder-anon-key"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Mirror of ENABLE_DEMO_AUTH for client components that want to show the
  // "Try a demo account" affordance. Safe to expose — it's just a UI hint.
  NEXT_PUBLIC_ENABLE_DEMO_AUTH: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

// Treat empty / whitespace-only env vars as "unset". Hosting dashboards
// (Vercel, etc.) commonly persist a variable as "" when you clear it, which
// would otherwise fail format validators like .email()/.url() that .optional()
// doesn't relax. Normalizing here keeps a blank var equivalent to absent.
const opt = (v: string | undefined): string | undefined =>
  v && v.trim() !== "" ? v : undefined;

const _server = serverSchema.parse({
  DATABASE_URL: opt(process.env.DATABASE_URL),
  DIRECT_URL: opt(process.env.DIRECT_URL),
  SUPABASE_SERVICE_ROLE_KEY: opt(process.env.SUPABASE_SERVICE_ROLE_KEY),
  ENABLE_DEMO_AUTH: opt(process.env.ENABLE_DEMO_AUTH),
  BETA_ACCESS_PASSWORD: opt(process.env.BETA_ACCESS_PASSWORD),
  FEEDBACK_EMAIL: opt(process.env.FEEDBACK_EMAIL),
  PLATFORM_ADMIN_EMAILS: opt(process.env.PLATFORM_ADMIN_EMAILS),
});

const _client = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: opt(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: opt(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_APP_URL: opt(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_ENABLE_DEMO_AUTH: opt(process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH),
});

export const env = { ..._server, ..._client };
