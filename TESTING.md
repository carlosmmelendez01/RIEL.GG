# RIEL.GG — Beta Tester Guide

Thanks for helping test RIEL.GG. This is an **early beta** focused on one
thing: the **core competition engine** — running a league from competition
setup through to coaches reporting match scores. A lot of the surrounding
features (messaging, brackets, announcements, player profiles) are visibly
marked **"Soon"** and aren't part of this round — don't worry about those.

What we want to learn: **does the core loop actually work, and where does it
feel confusing or broken?**

---

## Getting in

1. Go to **`<YOUR-VERCEL-URL>`**
2. Enter the beta password: **`<BETA-PASSWORD>`**
3. On the home page, click **"Try a demo account"** (top right) → you land on
   the account picker.

You'll sign in as a **real seeded account** — no email or password needed, one
click. Two roles matter for this test:

- **League admin** — `cmelendez@riel.gg` (marked *Recommended*) → runs the league
- **Coach** — `rpatel@hse.k12.in.us` (marked *Recommended*) → runs a school's teams

You can switch between them anytime by going back to **`/dev`**.

> ⚠️ This is shared demo data on a live database. Anything you create or change
> persists and is visible to others testing at the same time. That's expected —
> it's a sandbox.

---

## What to test — the core loop

Do these roughly in order. It's a chain: each step sets up the next.

### As the **League admin** (`cmelendez@riel.gg`)

1. **Create a competition** — `Competitions → New competition`. Pick a game
   (try **League of Legends**, tier **Varsity**), accept the default dates,
   and **Activate** it on the last step.
2. Later: **approve roster registrations** — `Competitions`, the gold
   *Pending roster registrations* card at the top. Approve the ones the
   coaches submit.
3. **Generate a schedule** — `Scheduler`. Find your competition and click
   **Generate**. (It only works once at least 2 teams are approved.)
4. **Review a match** — `All matches → open one`. Try the admin override
   actions (force score, mark disputed) and watch the audit trail update.

### As a **Coach** (`rpatel@hse.k12.in.us`)

5. **Register a team** — `Teams → open your League of Legends team →
   Register for a competition`. Pick the admin's new competition.
6. **Manage your roster** — add/remove players, invite someone to the school.
7. **Report a score** — `Schedule → open a match → submit the final score`.
   It moves to *Awaiting confirmation*.
8. **Confirm a score** — sign in as the *opposing* coach (e.g.
   `jreed@nc.k12.in.us`) and confirm or dispute the score the other coach
   reported. This is the consensus flow — it needs both sides.

### Also worth trying
- Apply as a brand-new school at **`/join`**, then approve it as the admin in
  `Schools`. (You'll get a claim link to share.)
- Toggle **light/dark mode** (top right).

---

## What's **not** in this round

These are intentionally unfinished and marked **"Soon"** in the sidebar —
please don't file them as bugs:

- Messages / chat, Announcements
- Brackets / playoffs, Divisions, Insights
- Player profiles & the player-facing experience
- Search bars and notifications
- The multi-tenant "Platform" admin

---

## Found something? Tell us

Use the **Feedback** button (bottom-right of every page) — it captures the page
you're on automatically, so you don't have to explain where you were. Be blunt;
"I didn't know what to click next" is exactly the kind of thing we want.

Thanks — this genuinely helps. 🎮
