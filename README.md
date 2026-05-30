# RIEL OS

> **System Activated. Competition Elevated.**
> The custom league management platform for the **Hoosier Esports Alliance (HEA)**.

A premium, modern, educator-first scholastic esports operating system. Built to feel like Linear / Notion / modern esports tools — not another generic admin panel.

## Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) + TypeScript |
| Styling | **Tailwind v4** + **shadcn/ui** (dark-first) |
| Auth + DB + Realtime + Storage | **Supabase** (Postgres, Auth, Storage, Realtime) |
| ORM | **Prisma 6** on top of Supabase Postgres |
| Client data | **TanStack Query** |
| Validation | **Zod** |
| Icons | **Lucide** |
| Deploy | **Vercel** |

## Brand

| Token | Hex | Usage |
|---|---|---|
| `--brand-crimson` | `#A31F34` | Primary, accents, CTAs |
| `--brand-gold` | `#FFCC00` | Highlights, awards, badges |
| `--brand-purple` | `#C026D3` | Subtle accent, secondary highlights |
| `--brand-ink` | `#0A0A0A` | App background |
| `--brand-onyx` | near-black | Card / surface |

Full token list lives in [`app/globals.css`](app/globals.css).

## Getting started

```bash
# 1. install
npm install

# 2. configure env
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY

# 3. push schema to Supabase (after env is set)
npx prisma db push

# 4. dev server
npm run dev
```

App runs at <http://localhost:3000>.

## Project layout

```
app/
  (marketing)/       # public landing pages
  (app)/             # authenticated app shell
  globals.css        # tailwind + brand tokens
  layout.tsx         # root layout, providers, metadata
  page.tsx           # landing page

components/
  brand/             # logo, lockups, brand-specific marks
  marketing/         # landing page sections
  dashboard/         # coach + admin dashboard surfaces
  providers/         # client-side providers (TanStack Query, etc.)
  ui/                # shadcn/ui primitives

lib/
  env.ts             # zod-validated env
  utils.ts           # cn() + helpers
  db/prisma.ts       # Prisma singleton
  supabase/          # client.ts, server.ts, middleware.ts
  validators/        # zod schemas
  queries/           # server-side data fetchers

prisma/
  schema.prisma      # data model

proxy.ts             # Supabase session refresh (Next 16 proxy convention)
```

## Domain model

Initial Prisma schema sketches the league domain. See [`prisma/schema.prisma`](prisma/schema.prisma) — covers:

- `User` (linked to Supabase auth) + `School` + roles
- `GameTitle` catalog
- `Season` → `Division` → `Team` → `Player`
- `Tournament`, `Match`, `MatchReport`
- `Announcement`

Expect this to evolve as features land.

## Differentiation

Important: **do not copy** proprietary UI/UX from LeagueOS, Fenworks, PlayVS, or similar tools. Build original, improved versions of standard league management features.

What we emphasize over those incumbents:

- **Coach-grade mobile** — most coaches run their program from a phone
- **Unified-first** — accessibility + inclusive program tools in the core
- **Real-time match status** via Supabase Realtime
- **AI-assisted scheduling** that respects school calendars + travel
- **Shareable, on-brand highlight cards** auto-generated from match results
- **Player development tracking** with exportable stats
- **Parent / student read-only portal**

## Scripts

```bash
npm run dev            # next dev (turbopack)
npm run build          # next build
npm run start          # next start
npm run lint           # eslint
npx prisma generate    # regenerate Prisma client
npx prisma db push     # push schema (dev)
npx prisma migrate dev # create + apply migration
```
