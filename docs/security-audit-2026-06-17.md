# RIEL.GG Security Audit

Date: 2026-06-17

## Scope

- Authentication, authorization, and role-routing boundaries
- Invite creation and claim flows
- Public routes, redirects, cookies, and response headers
- Prisma queries and SQL-injection exposure
- Student-data exports and audit logging
- Supabase Row Level Security migration coverage
- Production dependency advisories and accidental secret exposure

## Remediated

- Disabled one-click demo impersonation in production regardless of environment flags.
- Restricted local demo impersonation to an explicit account allowlist and configured password.
- Replaced `@riel.gg` domain-based platform trust with exact-email allowlisting.
- Required privileged school invites to be email-locked and single-use.
- Made school and league invite claims atomic to prevent concurrent over-claiming.
- Sanitized post-authentication and beta-gate redirects against external and encoded redirects.
- Replaced the beta cookie's 32-bit token with SHA-256 and shortened its lifetime to 30 days.
- Removed raw invite codes from audit-log payloads.
- Added deny-by-default RLS enablement for every Prisma application table.
- Added CSP, clickjacking, MIME-sniffing, referrer, and permissions response headers.
- Marked student-data exports private and non-cacheable.
- Changed sign-out to a same-origin POST and removed state-changing GET behavior.
- Upgraded Next.js to 16.2.9 and forced PostCSS 8.5.12 across the dependency tree.

## Verification

- `npm run lint`: passed
- `npm run build`: passed, including TypeScript and all 46 generated routes
- Package install audit: 0 known vulnerabilities
- Production package tree: Next.js 16.2.9, PostCSS 8.5.12, ws 8.21.0
- Redirect abuse cases: six protocol, encoded, slash, and backslash cases passed
- Static query review found no raw SQL, string-built SQL, `eval`, unsafe HTML injection, or child-process execution in application code.
- Secret review found no committed Supabase service-role key, database password, Resend API key, or beta password.

## Deployment Controls Still Required

1. Configure durable edge rate limits in Vercel Firewall for `/beta-gate/submit`, `/join`, and other anonymous mutation endpoints. In-memory application limits are not reliable across serverless instances.
2. Apply `prisma migrate deploy` during production deployment and verify RLS remains enabled after every schema change.
3. Keep `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_AUTH_EMAILS`, and `DEMO_AUTH_PASSWORD` out of Vercel production variables.
4. Configure error monitoring and security alerts without sending student records or message bodies as telemetry.
5. Re-run authenticated penetration testing against the deployed beta after the edge controls and production environment variables are configured.

## RLS Note

The current architecture accesses application data through Prisma's server-only database role. Supabase `anon` and `authenticated` roles are intentionally denied direct table access because RLS is enabled without client policies. Any future direct browser-to-Supabase data access must add narrowly scoped policies before release.

## Limitations

This audit combined source review, dependency scanning, build verification, database configuration review, and targeted abuse-case checks. It is not a substitute for an independent penetration test of the deployed infrastructure.
