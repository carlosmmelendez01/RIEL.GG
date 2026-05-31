# Deploying RIEL.GG to Vercel (beta)

This repo is configured for a one-import Vercel deploy. Follow these steps in
order — the env vars and the Supabase auth config are the two things that
trip up first deploys.

## 1. Import the repo

1. [vercel.com](https://vercel.com) → **Add New… → Project**
2. Import `carlosmmelendez01/RIEL.GG`
3. Framework preset auto-detects **Next.js**. Leave Build & Output settings on
   default — `npm run build` already runs `prisma generate && next build`, and
   `postinstall` regenerates the Prisma client on every build (so Vercel's
   dependency cache can never serve a stale client).
4. **Don't deploy yet** — add the environment variables first (next step),
   otherwise the first build will fail on env validation.

## 2. Environment variables

Add these under **Project → Settings → Environment Variables** (Production,
and Preview if you want PR previews). Pull the Supabase values from your
`.env.local`.

### Required

| Variable | Value / source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (publishable/anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret) — required for demo sign-in |
| `DATABASE_URL` | Supabase **pooler** URL, port **6543**, with `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Supabase **direct** URL, port **5432** (used only for migrations) |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL, e.g. `https://riel-gg.vercel.app` (no trailing slash) |

> **Pooler matters on Vercel.** Serverless functions open many short-lived
> connections; the transaction pooler (6543) is required or you'll exhaust
> Postgres connections. Your `.env.local` `DATABASE_URL` already uses it —
> copy that one.

### Beta controls

| Variable | Value |
|---|---|
| `ENABLE_DEMO_AUTH` | `true` |
| `NEXT_PUBLIC_ENABLE_DEMO_AUTH` | `true` |
| `BETA_ACCESS_PASSWORD` | a shared password you hand to demo viewers |
| `PLATFORM_ADMIN_EMAILS` | leave blank (keeps `/platform` closed) |

### Email (optional — feedback + invite emails)

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | from resend.com (omit → emails just console-log, app still works) |
| `RESEND_FROM_ADDRESS` | e.g. `RIEL.GG <hello@yourdomain>` (must be a Resend-verified domain) |
| `FEEDBACK_EMAIL` | where in-app feedback is delivered |

## 3. Point Supabase auth at the Vercel domain

Magic-link login and the demo sign-in write Supabase sessions, so Supabase has
to trust the production domain:

**Supabase → Authentication → URL Configuration**
- **Site URL**: `https://your-domain.vercel.app`
- **Redirect URLs**: add `https://your-domain.vercel.app/**`

Without this, sign-in redirects bounce or error.

## 4. Deploy

Click **Deploy**. The build runs `prisma generate && next build`. The database
schema is already applied (managed manually during development), so the app
runs against it immediately — no migration step needed for the first deploy.

### Applying future migrations

When you add a Prisma migration later, apply it to the database before/after
deploy from your machine:

```bash
npm run db:migrate:deploy   # prisma migrate deploy against DIRECT_URL
```

(We don't run this automatically in the Vercel build to avoid coupling deploys
to DB availability.)

## 5. Post-deploy smoke test

1. Visit the domain → you should hit the **/beta-gate** password screen.
2. Enter `BETA_ACCESS_PASSWORD` → lands on the marketing home with a **BETA** badge.
3. Click **Try a demo account** → `/dev` launcher.
4. Sign in as the **Recommended** league admin (`cmelendez@riel.gg`) → rich `/admin`.
5. Sign in as the **Recommended** coach (`rpatel@hse.k12.in.us`) → rich `/dashboard`.
6. Open the **Feedback** button (bottom-right) → submit → confirm it returns a reference id.

## Updates

Every `git push` to `main` triggers an automatic production deploy. Pushes to
other branches create preview deployments.
