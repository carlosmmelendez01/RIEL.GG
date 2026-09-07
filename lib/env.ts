import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Beta / demo controls ---------------------------------------------
  // Local-development switch for one-click demo sign-in. Production refuses
  // demo auth even when this flag is accidentally left enabled.
  ENABLE_DEMO_AUTH: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Local-development only. Production code refuses demo auth regardless of
  // these values so a stale hosting flag cannot reopen the impersonation path.
  DEMO_AUTH_EMAILS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  DEMO_AUTH_PASSWORD: z.string().min(12).optional(),
  // Shared password for the beta access gate. When set, every route is
  // locked behind /beta-gate until the visitor enters it. Unset = open.
  BETA_ACCESS_PASSWORD: z.string().optional(),
  // Where in-app feedback is delivered. Falls back to RESEND_FROM_ADDRESS's
  // implied inbox if unset; we just won't email if neither is configured.
  FEEDBACK_EMAIL: z.string().email().optional(),
  // Build-time switch for the /platform/* SaaS-admin surface. Those pages are
  // still backed by lib/mock/* — fabricated schools, audit rows and tickets —
  // so they are OFF unless a build explicitly turns them on. The email
  // allowlist below is a second gate, not the only one.
  ENABLE_PLATFORM_ADMIN: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Comma-separated allowlist of emails permitted into /platform/*. Only
  // consulted when ENABLE_PLATFORM_ADMIN is true.
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
  DEMO_AUTH_EMAILS: opt(process.env.DEMO_AUTH_EMAILS),
  DEMO_AUTH_PASSWORD: opt(process.env.DEMO_AUTH_PASSWORD),
  BETA_ACCESS_PASSWORD: opt(process.env.BETA_ACCESS_PASSWORD),
  ENABLE_PLATFORM_ADMIN: opt(process.env.ENABLE_PLATFORM_ADMIN),
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
