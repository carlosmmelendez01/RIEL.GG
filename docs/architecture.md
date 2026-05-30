# RIEL OS — Architecture (v1)

This document explains the data model, permission model, match lifecycle, scheduling architecture, and operational concerns. It's the companion to [`prisma/schema.prisma`](../prisma/schema.prisma).

The schema was informed by reading LeagueOS's public help center to understand the scholastic esports domain. **No proprietary UI patterns or workflows are copied** — only canonical domain concepts (Group/Team/Roster, Stages, Rounds, etc.) which are industry-standard for tournament management.

---

## 1. Identity model

```
League ── LeagueMembership ── School ── SchoolMembership ── User
                                │
                                └─ Team ── TeamMembership ── User
                                     │
                                     └─ Roster ── RosterMembership ── User
```

### Why three membership tables

A user has **independent roles at three scopes**: their School, their long-lived Teams, and the per-event Rosters they compete on. Same user can be:

- **Manager** at MCHS (school-wide invites + team creation)
- **Coach** on the MCHS Varsity LoL Team (template-level)
- **Captain** on the Spring 2026 Varsity LoL Roster (event-level)
- **Player** on the Spring 2026 Varsity Valorant Roster (different event)

A flat `User.role` enum can't model this. We use `SchoolMembership`, `TeamMembership`, `RosterMembership` — each with its own `role` enum scoped to that level.

### Schools are independent of leagues

A School is a standalone entity. It can join multiple Leagues via `LeagueMembership`. League-specific overrides (display name, status) live on the membership row, not the School. That keeps MCHS Wolves identifiable even if they compete in IHSEN, a regional cup, and a separate inclusive league simultaneously.

### Detached members

`SchoolMembership.detached: Boolean` flags a user who's mid-transfer or separated from their school but whose data we want to retain (audit, stats, prior matches). The user keeps their account; queries filter out detached members for current operations but can still trace history.

### NCES integration

`School.ncesId` is the National Center for Education Statistics unique identifier. When a league admin onboards a school, we autofill from the NCES public API rather than asking them to type "Fishers HS, Indiana" by hand. Verified-school badge in the UI builds trust.

---

## 2. Team vs Roster — the keystone distinction

**Team is a long-lived template.** It carries the brand identity (name, colors, avatar, hero image), the game/format/tier, preferred regions, and weekly availability windows. It persists across seasons.

**Roster is event-specific.** It links a Team to a Competition. The five players who showed up for Spring 2026 LoL Varsity are not the same five who'll show up for Fall 2026. The Team identity stays; the Roster snapshot changes.

This split eliminates a real problem: under a single-`Team`-with-`players` model, last season's stats and current season's roster get tangled. Splitting them makes "team history" and "current lineup" cleanly separable.

### Multi-axis roster state

Rosters have **four orthogonal state axes**, each gating a different concern:

| Axis | Values | What it gates |
|---|---|---|
| `participation` | ACTIVE / INACTIVE | Inclusion in schedule generation |
| `editLock` | OPEN / LOCKED | Member list and roles can change |
| `presentationLock` | OPEN / LOCKED | Brand assets (name, colors, images) can change |
| `lifecycle` | ACTIVE / ARCHIVED | Roster has exited the competition |

Real-world example: during a playoff broadcast, lock `presentationLock` (no logo changes mid-stream) while `participation` stays ACTIVE. After elimination, flip `lifecycle` to ARCHIVED — Roster is preserved for stats but excluded from active rosters lists.

We use plain English (`ACTIVE/INACTIVE/LOCKED/ARCHIVED`) instead of cute terminology. Discoverable without help docs.

---

## 3. Competition hierarchy

```
Season              "Spring 2026"          (calendar period under a League)
  └─ Competition    "Spring 2026 Rocket League Varsity"
      └─ Stage      "League Play" / "Playoffs"
          └─ Round  "Week 1" / "Quarterfinals"
              └─ Match
                  └─ Game (per Match — Bo3 has up to 3 Games)
                      └─ GameAppearance (per-Game player activity, with sub support)
```

### Why both Season AND Competition

Schools think in *seasons* — "Spring 2026" is one calendar period running multiple game leagues in parallel. A single object can't be both temporal and game-specific without confusion.

- **Season** = calendar period, scoped to a League
- **Competition** = game × tier within a Season ("Spring 2026 Rocket League Varsity")

Coaches see "Spring 2026" on their dashboard with all their Competitions under it. Admins configure Competitions individually.

### State + Status

Following the LeagueOS convention (these are just industry-standard):

- `state: ContentState` — visibility (`DRAFT` / `ACTIVE` / `COMPLETE`)
- `status: ContentStatus` — lifecycle (`SEEDING` / `IN_PROGRESS` / `FINISHED`)

Both apply at Competition AND Stage level. They're orthogonal: a Competition can be `ACTIVE + IN_PROGRESS` (live), `ACTIVE + FINISHED` (visible but done), or `COMPLETE + FINISHED` (archived).

### Stages = phases

A Competition has one or more Stages: League Play → Playoffs → Grand Finals. Each Stage has its own format (Bo3 in regular season, Bo5 in playoffs), sequencing rules, scheduling method, scoring config. Stages let us model the regular-season-then-bracket pattern that's standard in scholastic esports.

### Rounds = match groupings within a Stage

"Week 1", "Quarterfinals", "Group A Round Robin Day 1" — Round is the grouping that lets coaches see "what's on this week" and lets admins bulk-shift dates if a holiday lands mid-season.

---

## 4. Match lifecycle

State machine for a Match:

```
SCHEDULED
   ↓ (start time arrives, players check in)
CHECKING_IN
   ↓ (admin or coach starts the match)
IN_PROGRESS
   ↓ (Games played, scores entered)
AWAITING_CONFIRMATION
   ↓ (per Stage.confirmationMode)
   ├── CONSENSUS:    both sides confirm → FINISHED
   └── DELAYED_AUTO: single confirm + delay → FINISHED
↘ FORFEITED  (one side no-shows or forfeits)
↘ CANCELED   (weather, equipment, league call)
↘ DISPUTED   (out-of-band — admin review)
```

### Per-game data

A Match contains many `Game`s. Each Game has scores, an explicit `winnerSide` flag (separate from score because score alone is ambiguous in some games), mode, map, and `GameAppearance` rows for which players were active. **Substitution is per-Game**, so a coach can sub Marcus in for Game 2 without restarting the Match.

### Confirmation reset rule

Any edit to a confirmable field (`scores`, `winnerSide`, stats, character picks, etc.) **resets all confirmations**. Both sides must re-confirm. The UI surfaces this as a warning before save: "This will require both teams to re-confirm."

### Reporting vs confirming

`MatchReport` is a *submission* — the score one coach entered, with notes and evidence. It doesn't move the match state. Confirmation is a separate action where both sides agree the report is correct. This separates "what happened" from "we agree on what happened" — which lets us model disputes cleanly (two reports with different scores → DISPUTED).

### Evidence storage

Screenshots and clips upload to Supabase Storage. `MatchReportEvidence.storagePath` is the object path. We never inline binary in Postgres.

### Real-time updates

Live match status, score changes, and chat messages publish via Supabase Realtime. Each match page subscribes to its `matchId` channel; one update fans out to both coaches' dashboards plus any spectators.

---

## 5. Permission model

Roles are scoped to their level. A user's effective permissions = union of all their memberships.

| Level | Roles |
|---|---|
| League | OWNER, ADMIN, STAFF |
| School | MANAGER, COACH, PLAYER (+ `isOwner` flag) |
| Team | MANAGER, COACH, CAPTAIN, PLAYER |
| Roster | MANAGER, COACH, CAPTAIN, PLAYER |

### Permission resolution

For any action (e.g., "submit match report"), the authorization check walks from most-specific to most-general:

1. Is the user a Roster member with role `COACH | MANAGER` on either side of this match? → allow
2. Is the user a Team member with role `COACH | MANAGER` on the parent team? → allow
3. Is the user a School member with role `COACH | MANAGER` on the parent school? → allow
4. Is the user a League ADMIN/OWNER on the parent league? → allow (admin override)
5. Otherwise → deny

This composability handles the real-world cases: school AD has implicit access to every team they oversee; league admin can intervene anywhere; a player on Roster A can't submit results for Roster B even if they're on the same Team.

### Cosmetic roles dropped

LeagueOS ships `PRODUCTION | STAFF | SOCIAL | STATS` as cosmetic roles that grant nothing. We don't. If a role doesn't gate behavior, it's noise. We can add real broadcast/staff roles later when they have real permissions.

---

## 6. Registration modules

A Competition can require onboarding steps before a Roster is eligible to compete:

- `GAME_ACCOUNT_LINK` (e.g., connect Riot ID)
- `DOCUMENT_UPLOAD` (eligibility form, code of conduct)
- `PARENTAL_CONSENT` (under-18 leagues)
- `OFFICIAL_APPROVAL` (league office review)
- `FEE_PAYMENT` (paid leagues)
- `CUSTOM` (escape hatch with `config: Json`)

`RosterModuleStatus` tracks per-roster progress. Until all required modules are `APPROVED`, the Roster's `registrationStatus` stays `PENDING` and it's excluded from schedule generation.

This is reusable infrastructure — the same module framework handles every league's varying requirements without per-league code.

---

## 7. Scheduling architecture (the differentiator)

LeagueOS has manual scheduling + an Elo-based placement matchmaker. Their "Sequencing" tab configures pacing rules but doesn't generate schedules. We build a proper auto-generator.

### Scheduling input

For a given Stage, the scheduler reads:

- All `Roster`s with `participation: ACTIVE` and `registrationStatus: APPROVED`
- Each Team's `availabilityWindows` (weekday + time-of-day windows)
- The Stage's sequencing config (`matchIntervalMinutes`, `concurrentMatches`, `checkInWindowMinutes`)
- The Stage's `schedulingMethod`: ROUND_ROBIN, SWISS, SINGLE_ELIM, DOUBLE_ELIM, PLACEMENT, CUSTOM
- Existing matches in adjacent Stages (so playoffs don't conflict with finale week)

### Constraint solving

Treat as a constraint satisfaction problem with soft objectives:

**Hard constraints:**
- No team plays two matches in the same time slot
- Match falls within both teams' availability windows
- Reschedule cutoff respected (no last-minute slots)

**Soft objectives** (multi-objective optimization, weighted):
- Competitive balance (teams of similar Elo paired more often in Swiss)
- Travel fairness (alternate home/away)
- Rest distribution (minimum N hours between consecutive matches per roster)
- School-night avoidance (de-prioritize after-9pm slots on weekdays)
- Player rest (no roster plays back-to-back if avoidable)

For round robin, this collapses to a known polynomial problem. For Swiss / playoff brackets, we use a heuristic search (greedy with backtracking) — fine for league sizes up to ~64 teams per division.

### "AI-assisted" mid-season

The continuous-mode scheduler watches for events that invalidate the schedule:

- Team availability changes (coach updates window) → flag affected matches
- Match canceled / forfeited → suggest replacement slot
- New roster joins late → integrate into remaining matches
- School calendar conflict added → propose alternative

Suggestions surface in the Coach Dashboard as the "Smart Suggestion" panel we already built — they propose changes, never auto-apply. League admin or both coaches must accept.

### Visibility

Every scheduling decision is **explainable**: when the scheduler proposes "Carmel vs HSE at Friday 5pm," clicking the match shows the reasoning ("Both available, neutral home/away, 4-day rest from last match"). LeagueOS's match generator is opaque — ours is not.

---

## 8. Audit logging

`AuditLog` ships from day one. Every state-changing action records:

- `actorUserId` (who)
- `action` (e.g., `ROSTER.CREATE`, `MATCH.CONFIRM`, `MATCH.SCORE_EDIT`, `INVITE.ACTIVATE`)
- `entityType` + `entityId` (what was affected)
- `before` + `after` (Json snapshots — diffable)
- `metadata` (request context, IP if applicable)
- Scope hooks: `leagueId`, `schoolId`, `competitionId`, `matchId` for fast filtering

The audit timeline appears as a tab on every entity page (League, Competition, Stage, Roster, Match). Coaches can see who edited the score and when. League admins can investigate disputes by reading the full timeline.

This is differentiation: LeagueOS's docs say "Audit Log (coming soon)" — we ship it as table stakes.

---

## 9. Storage

| Concern | Where |
|---|---|
| Auth | Supabase auth (`User.authId` bridges to `auth.users.id`) |
| Database | Supabase Postgres (Prisma client) |
| Real-time | Supabase Realtime (match state, chat) |
| Files | Supabase Storage (`MatchReportEvidence.storagePath`, team logos, etc.) |
| Background jobs | TBD — likely Vercel cron + queued worker for scheduled tasks (auto-finish matches, NCES sync) |

### Row-level security

Postgres RLS policies will mirror the permission resolution above. The Prisma client runs as a connection-pooled Postgres user; for per-request RLS we'll either:

- Use Supabase's PostgREST-style auth via the `@supabase/ssr` client for read paths, OR
- Set `request.jwt.claims` via Postgres `set_config` before each Prisma query

Decision deferred until we have real auth — for the demo, mock data sidesteps this.

---

## 10. What's deferred

These exist in the schema as `Json` fields or are noted as out-of-scope, but we're not building them yet:

- **LAN resources** (lanes, stations, color tags) — `Stage.resourcesConfig: Json?`
- **Discord bot integration** — `Competition.discordConfig: Json?`
- **Auto-stat ingestion** from game APIs (Riot, Epic, etc.) — `GameAppearance.stats: Json?`
- **Rewards / badges** — `Competition.rewardsConfig: Json?`
- **Custom points scoring** — `Stage.pointsConfig: Json?`
- **Webhooks** for league-to-league integration
- **Streaming overlays** + OBS integration
- **Recruiter / Message Flow features** (out of HEA scope)

Each is a future feature, not a v1 oversight.

---

## 11. Migration path from mock data

The current dashboard reads from `lib/mock/data.ts`. To go live:

1. Provision Supabase project; populate `.env.local` from `.env.example`
2. `npx prisma db push` to materialize the schema
3. Seed reference data (game titles, formats, tier definitions) via `prisma/seed.ts` (TBD)
4. Build server actions that mirror current mock helpers (`myUpcomingMatches()`, `standingsFor(game)`, etc.) to query Prisma instead
5. Swap component imports from `@/lib/mock/data` to `@/lib/queries/...`
6. Stand up auth + middleware (already scaffolded)
7. Cut over

The mock module's shape was deliberately chosen to map cleanly onto the real schema, so the swap is mechanical — not a rewrite.
