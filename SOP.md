# RIEL.GG — Standard Operating Procedures

The operating manual for running, demoing, and deploying RIEL.GG, plus the
in-app procedures for running a season as a league admin and managing a team
as a coach.

**Last updated:** keep this current as workflows change.

---

## Contents

- [0. Key facts & access](#0-key-facts--access)
- [Part A — Operator procedures](#part-a--operator-procedures-you)
  - [A1. Run the app locally](#a1-run-the-app-locally)
  - [A2. Demo the app](#a2-demo-the-app)
  - [A3. Ship a change (git → Vercel)](#a3-ship-a-change-git--vercel)
  - [A4. Manage the beta](#a4-manage-the-beta)
  - [A5. Database operations](#a5-database-operations)
- [Part B — Run a season (League Admin)](#part-b--run-a-season-league-admin)
- [Part C — Manage a team (Coach)](#part-c--manage-a-team-coach)
- [Part D — Troubleshooting](#part-d--troubleshooting)

---

## 0. Key facts & access

| Thing | Value |
|---|---|
| Production URL | `https://riel-gg.vercel.app` |
| Beta access password | the value of `BETA_ACCESS_PASSWORD` in Vercel (intended: `beta7382RIEL`) |
| Code repo | `github.com/carlosmmelendez01/RIEL.GG` |
| Local project path | `~/Documents/Esports/riel-os` ← **always work here** |
| Local dev URL | `http://localhost:3000` (no beta gate locally) |
| Demo account launcher | `/dev` (works when `ENABLE_DEMO_AUTH=true`) |
| Hosting | Vercel (app) + Supabase (database + auth) |

**Recommended demo accounts** (richest seeded data):
- League admin → `cmelendez@riel.gg`
- Coach → `rpatel@hse.k12.in.us` (Fishers)

> ⚠️ Local dev and production share the **same Supabase database.** Anything
> you change locally is live for everyone. Treat it as one shared sandbox.

---

## Part A — Operator procedures (you)

### A1. Run the app locally

1. Open Terminal.
2. `cd ~/Documents/Esports/riel-os`
3. `npm run dev`
4. Open `http://localhost:3000`.
5. To stop: `Ctrl+C` in that Terminal window.

If dependencies changed (after `git pull`): run `npm install` first.

### A2. Demo the app

1. Make sure the server is running (A1) — or use the live URL.
2. Go to `/dev` (locally: `http://localhost:3000/dev`).
3. Click a **Recommended** account to sign in instantly (no password).
4. Walk the core loop (see Part B / Part C, or `TESTING.md`).
5. To switch roles mid-demo, go back to `/dev` and pick another account.

> For a clean demo, reseed first (A5) so the data looks pristine.

### A3. Ship a change (git → Vercel)

Every push to `main` auto-deploys to production.

1. `cd ~/Documents/Esports/riel-os`
2. `git add -A`
3. `git commit -m "short description of the change"`
4. `git push`
5. Watch the deploy in the Vercel dashboard → **Deployments**. Green = live.

Using **GitHub Desktop** instead? Commit + Push from there — same result.
(Make sure GitHub Desktop points at `~/Documents/Esports/riel-os`, not any
other folder.)

### A4. Manage the beta

**Change the beta access password:**
1. Vercel → **riel-gg** project → **Settings → Environment Variables**.
2. Edit `BETA_ACCESS_PASSWORD` → new value → **Save**.
3. **Deployments → latest → ⋯ → Redeploy** (env changes only apply on redeploy).

**Add a tester:** just give them the URL + the beta password. They don't need
an account — they use the `/dev` demo accounts. (Fill in `TESTING.md` and send
them that.)

**Turn the beta gate off entirely:** clear `BETA_ACCESS_PASSWORD` in Vercel +
redeploy.

**Read feedback:** in-app **Feedback** button submissions are stored in the
`Feedback` table (and emailed to `FEEDBACK_EMAIL` if Resend is configured).

### A5. Database operations

Run from `~/Documents/Esports/riel-os`:

| Task | Command | Notes |
|---|---|---|
| Reseed (top up demo data) | `npm run db:seed` | Idempotent — safe to re-run |
| Full reset (wipe + reseed) | `npm run db:reset` | ⚠️ Destroys ALL data, incl. anything testers created |
| Apply a new migration | `npm run db:migrate:deploy` | After adding a Prisma migration |

> `db:reset` hits the **shared** database — don't run it mid-demo or while
> testers are active.

---

## Part B — Run a season (League Admin)

Sign in as a league admin (`cmelendez@riel.gg` for the demo). All routes below
are under `/admin`.

### B1. Onboard a school
1. A coach applies at `/join` (no account needed).
2. Go to **Schools** (`/admin/schools`) → the gold **Approval queue** card.
3. Review the application → **Approve** (creates the school + league membership
   + a claim link) or **Reject** (with a reason).
4. On approval, **copy the claim link** and send it to the coach. They open it,
   sign in, and become the school's owner.

### B2. Create a competition
1. **Competitions → New competition** (`/admin/competitions/new`).
2. Step through the wizard: name, game, tier, dates, format (e.g. **Round
   Robin + Single Elim** to enable playoffs), match settings.
3. On the last step click **Activate competition**.

### B3. Approve roster registrations
1. Coaches register their teams (Part C3).
2. **Competitions** (`/admin/competitions`) → the **Pending roster
   registrations** card at the top.
3. **Approve** each roster (or **Reject** with a reason). Only approved rosters
   are scheduled.

### B4. Generate the regular-season schedule
1. **Scheduler** (`/admin/scheduler`).
2. Find the competition → **Generate**. Requires ≥ 2 approved rosters.
3. This creates the full round-robin schedule (every team plays every team).

### B5. Run the playoffs
> Only for competitions with a Single-Elim stage. Finish the regular season first.
1. **Scheduler** → the competition's gold **Playoffs** button.
2. First click **seeds the bracket** from final standings (top seeds kept apart).
3. After each round's matches finish, click **Playoffs** again to **advance the
   winners** to the next round.
4. Repeat until a champion is decided.
5. View the live bracket on the competition's detail page: **Competitions →
   click the competition** (`/admin/competitions/[id]`).

### B6. Resolve disputes & overrides
1. When a coach disputes a reported score, the match shows as **Disputed**
   (visible on the `/admin` dashboard and `/admin/matches`).
2. Open the match (`/admin/matches/[id]`).
3. Use **Admin overrides**: Force final score, Mark disputed, Override status,
   or Revert forfeit. Each requires a reason and is recorded in the audit log.

---

## Part C — Manage a team (Coach)

Sign in as a coach (`rpatel@hse.k12.in.us` for the demo). Routes under `/dashboard`.

### C1. Claim your school (first time)
1. Open the claim link your league admin sent you.
2. Sign in with the email the invite was issued to.
3. Click **Claim** → you're now the school's owner.

### C2. Create a team
1. **Teams** (`/dashboard/teams`) → **New team**.
2. Pick the game, tier, and (optionally) a custom name → **Create team**.

### C3. Register for a competition
1. **Teams** → open the team → **Register for a competition**.
2. Pick an open competition (must match the team's game + tier) → **Register**.
3. Status shows **Pending** until the league admin approves it.

### C4. Build your roster
1. On the team page, under the roster, **add a player** by email.
   - If they don't have an account yet, use **Invite to the school** → send them
     the link; they sign in, then you add them.
2. Manage assistant coaches + players from **School** (`/dashboard/school`):
   **Invite someone**, copy the link or send by email, and **Revoke** invites.

### C5. Report a match score
1. **Schedule** (`/dashboard/matches`) → open the match.
2. Enter the final score → **Submit**. Status → **Awaiting confirmation**.
3. The **opposing coach** opens the same match and **Confirms** (→ Finished) or
   **Disputes** (→ league admin resolves).

---

## Part D — Troubleshooting

| Symptom | Fix |
|---|---|
| "Demo sign-in is disabled" | `ENABLE_DEMO_AUTH` not `true` in that environment |
| Beta password rejected | Vercel `BETA_ACCESS_PASSWORD` differs from what you typed; update it + **redeploy** |
| Coach can't see a competition to register for | Competition's game/tier must match the team; registration window must be open; school must be an active league member |
| "Generate" (scheduler) disabled | Needs ≥ 2 **approved** rosters, and refuses if the stage already has matches |
| "Playoffs" won't seed | Finish the regular season first; needs a Single-Elim stage |
| Bracket shows "not seeded yet" | Run the **Playoffs** button to seed it |
| Email links point to localhost | Set `NEXT_PUBLIC_APP_URL` to the Vercel URL + redeploy |
| Real coaches can't sign up (magic link) | Supabase Auth SMTP not configured — see notes below |
| GitHub Desktop shows no files | It's pointed at the wrong folder — add `~/Documents/Esports/riel-os` |

**Known limitation — real self-signup:** magic-link login uses Supabase's
built-in SMTP, which is rate-limited and testing-only. For real (non-demo)
users to sign up reliably, configure Supabase → Authentication → SMTP with a
real provider (Resend/Postmark). Until then, use the `/dev` demo accounts.

---

## References
- `DEPLOY.md` — first-time Vercel deploy + environment variables
- `TESTING.md` — beta tester guide (hand this to testers)
- `README.md` — project overview
