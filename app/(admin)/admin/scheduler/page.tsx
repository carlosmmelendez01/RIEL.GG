/**
 * Scheduler — basic round-robin generator, per competition.
 *
 * Each competition row in the admin's league gets a "Generate schedule"
 * button that calls `runScheduler` (in lib/competition/competition-actions).
 * The action writes a Round + Match set for the first round-robin stage
 * using the circle method. Already-scheduled stages are locked.
 *
 * A future "AI scheduler" pass will replace this with a constraint solver
 * that respects availability, travel, and matchup history — the surface
 * here is the right home for that, just smarter.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCog,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { SchedulerTrigger } from "@/components/admin/scheduler-trigger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadLeagueAdminDashboard,
  requireLeagueAdmin,
} from "@/lib/league-admin/dashboard";

export default async function AISchedulerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/scheduler");

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="AI Scheduler" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const data = await loadLeagueAdminDashboard(user.id);
  const competitions = data?.competitions ?? [];

  return (
    <>
      <AdminTopbar title="Scheduler" eyebrow={`${ctx.league.name} · round-robin generator`} />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Command center
          </Link>
        </div>

        {/* Intro card */}
        <Card className="border-border/60 bg-card/80">
          <CardContent className="grid gap-6 px-6 py-8 md:grid-cols-[1fr_auto] md:items-center md:px-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
                Round-robin generator
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                Generate a full season schedule in one click.
              </h2>
              <p className="mt-3 max-w-xl text-balance text-[14px] leading-relaxed text-muted-foreground">
                Pairs every approved roster against every other one using the standard circle
                method, packed into per-week rounds at your stage&apos;s match interval. Already-
                scheduled stages stay locked. A future pass adds availability constraints and
                travel-aware pairing.
              </p>
            </div>
            <div className="hidden h-32 w-32 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)] md:flex">
              <CalendarCog className="h-12 w-12" />
            </div>
          </CardContent>
        </Card>

        {/* What it handles today */}
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              What runs today
            </p>
            <CardTitle className="text-base">Today vs the future solver</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Live now: full round-robin",
                body: "Every approved roster plays every other once. Pairings produced via the circle method, each round one calendar day apart.",
              },
              {
                title: "Live now: single-elim playoffs",
                body: "Once the regular season finishes, the Playoffs button seeds a bracket from standings (top seeds kept apart), then advances winners one round at a time to a champion.",
              },
              {
                title: "Coming later: availability",
                body: "Per-school day-of-week + time-of-day preferences, blackout dates, school holidays.",
              },
              {
                title: "Coming later: smarter seeding + double-elim",
                body: "Fair-play distribution of tough matchups, byes for non-power-of-two fields, and double-elimination brackets.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border/60 bg-background/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-[14px] font-semibold">{f.title}</h3>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Competitions */}
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Run the scheduler
            </p>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-[color:var(--brand-purple)]" />
              Competitions in your league
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {competitions.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                No competitions yet.{" "}
                <Link
                  href="/admin/competitions/new"
                  className="text-[color:var(--brand-crimson)] underline-offset-4 hover:underline"
                >
                  Create one
                </Link>{" "}
                first, then come back here to schedule.
              </p>
            ) : (
              <ul className="space-y-1">
                {competitions.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2.5 hover:bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.game} · {c.registeredTeams} approved team
                        {c.registeredTeams === 1 ? "" : "s"} ·{" "}
                        {c.matchesTotal > 0
                          ? `${c.matchesPlayed}/${c.matchesTotal} matches played`
                          : "no schedule yet"}
                        {" · "}
                        <span className="uppercase tracking-wider">{c.state.toLowerCase()}</span>
                      </p>
                    </div>
                    <SchedulerTrigger
                      competitionId={c.id}
                      hasMatches={c.matchesTotal > 0}
                      rosterCount={c.registeredTeams}
                      hasPlayoffStage={c.hasPlayoffStage}
                      compact
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
