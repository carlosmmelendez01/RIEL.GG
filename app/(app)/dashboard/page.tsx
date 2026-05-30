/**
 * Coach dashboard root.
 *
 * Server component — pulls real data from Prisma via `loadCoachDashboard`,
 * scoped strictly to the schools the signed-in coach is affiliated with.
 * Coaches at different schools see entirely different dashboards.
 *
 * Empty-state ladder:
 *   1. Not signed in → redirect to /login
 *   2. Signed in but no school context → DashboardEmptyState(no-school)
 *   3. Has school but no teams registered → DashboardEmptyState(no-teams)
 *   4. Has teams but no matches scheduled → still renders teams + standings,
 *      with a no-matches empty state in the upcoming-matches slot
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  CalendarDays,
  Flag,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchStateMark, matchStatusToState } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadCoachDashboard,
  type CoachRecentResult,
  type CoachStandingRow,
  type CoachTeamRow,
  type CoachUpcomingMatch,
} from "@/lib/coach/dashboard";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const data = await loadCoachDashboard(user.id);

  // 1. No school context at all
  if (!data) {
    return (
      <>
        <Topbar title="Dashboard" eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-school" />
        </main>
      </>
    );
  }

  const { coach, teams, upcomingMatches, recentResults, standings, totalWins, totalLosses, totalForfeits, rosterSize } = data;

  // 2. School exists but no teams registered yet
  if (teams.length === 0) {
    return (
      <>
        <Topbar title={`${coach.schoolShortName ?? coach.schoolName} dashboard`} eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-teams" schoolName={coach.schoolName} />
        </main>
      </>
    );
  }

  const winRatePct = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0;

  return (
    <>
      <Topbar
        title={`${coach.schoolShortName ?? coach.schoolName} dashboard`}
        eyebrow={`Spring 2026 · ${teams.length} team${teams.length === 1 ? "" : "s"}`}
      />

      <main className="flex-1 space-y-8 px-6 py-6 md:px-8">
        {/* Greeting + headline */}
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {greeting()}, <span className="text-foreground">{coach.name}</span>.
            </p>
            <h2 className="mt-1 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              {upcomingMatches.length > 0 ? (
                <>
                  You have{" "}
                  <span className="text-[color:var(--brand-crimson)]">
                    {upcomingMatches.length} match{upcomingMatches.length === 1 ? "" : "es"}
                  </span>{" "}
                  on deck.
                </>
              ) : (
                <>No matches scheduled. Take the night off, coach.</>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/8 px-3 py-2">
            <Sparkles className="h-4 w-4 text-[color:var(--brand-purple)]" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{coach.schoolName}</span>
              {coach.schoolShortName ? ` · ${coach.schoolShortName}` : ""}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active teams"
            value={String(teams.length)}
            icon={Users}
            delta={{
              value: `${rosterSize} player${rosterSize === 1 ? "" : "s"} rostered`,
              trend: "flat",
            }}
          />
          <StatCard
            label="Upcoming matches"
            value={String(upcomingMatches.length)}
            icon={Calendar}
            delta={{ value: "Next 30 days", trend: "flat" }}
            tone="crimson"
          />
          <StatCard
            label="Season record"
            value={`${totalWins}–${totalLosses}`}
            icon={Trophy}
            delta={{
              value: `${winRatePct}% win rate`,
              trend: winRatePct >= 50 ? "up" : "down",
            }}
            tone="gold"
          />
          <StatCard
            label="Forfeits"
            value={String(totalForfeits)}
            icon={Flag}
            delta={{
              value:
                totalForfeits === 0
                  ? "Perfect attendance"
                  : `${totalForfeits} this season`,
              trend: totalForfeits === 0 ? "up" : "down",
            }}
          />
        </section>

        {/* Main grid */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <UpcomingMatchesCard matches={upcomingMatches} />
            {recentResults.length > 0 ? <RecentResultsCard results={recentResults} /> : null}
          </div>
          <div className="space-y-6">
            <MyTeamsCard teams={teams} />
            <StandingsCard rows={standings} />
          </div>
        </section>
      </main>
    </>
  );
}

// --- Subcomponents ------------------------------------------------------

function UpcomingMatchesCard({ matches }: { matches: CoachUpcomingMatch[] }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            Schedule
          </p>
          <CardTitle className="text-base">Upcoming matches</CardTitle>
        </div>
        <p className="text-[11px] text-muted-foreground">{matches.length} in window</p>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {matches.length === 0 ? (
          <div className="py-8">
            <DashboardEmptyState kind="no-matches" />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {matches.map((m) => (
              <li key={m.matchId} className="px-3 py-3">
                <Link
                  href={`/dashboard/matches/${m.matchId}`}
                  className="flex items-center gap-3 rounded-md hover:bg-card"
                >
                  <MatchStateMark state={matchStatusToState(m.status)} size={20} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {m.ownTeamName} <span className="text-muted-foreground">vs</span>{" "}
                      {m.opponentTeamName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatMatchDate(m.scheduledAt)} · {m.competitionName}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px]">
                    {m.game}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentResultsCard({ results }: { results: CoachRecentResult[] }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Recent results
        </p>
        <CardTitle className="text-base">Last {results.length} matches</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ul className="divide-y divide-border/60">
          {results.map((r) => (
            <li key={r.matchId} className="flex items-center gap-3 px-3 py-2.5">
              <span
                className={cn(
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase tracking-wider",
                  r.isWin
                    ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : "border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
                )}
              >
                {r.isWin ? "W" : "L"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  vs {r.opponentTeamName}
                  {r.isForfeit ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded-sm border border-orange-500/30 bg-orange-500/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-orange-500">
                      <Flag className="h-2.5 w-2.5" />
                      Forfeit
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.game} · {r.finishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              {r.ourScore !== null && r.theirScore !== null ? (
                <p className="font-mono text-[13px] font-bold tabular-nums">
                  {r.ourScore}<span className="text-muted-foreground">–</span>{r.theirScore}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MyTeamsCard({ teams }: { teams: CoachTeamRow[] }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            My teams
          </p>
          <CardTitle className="text-base">{teams.length} active</CardTitle>
        </div>
        <Link
          href="/dashboard/teams"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Manage <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ul className="space-y-1">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-card">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{t.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t.tier} · {t.rosterSize} player{t.rosterSize === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px]">
                <span className="font-mono tabular-nums text-muted-foreground">
                  {t.wins}-{t.losses}
                </span>
                {t.streak !== 0 ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-semibold",
                      t.streak > 0 ? "text-emerald-500" : "text-[color:var(--brand-crimson)]",
                    )}
                  >
                    {t.streak > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(t.streak)}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StandingsCard({ rows }: { rows: CoachStandingRow[] }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            Standings
          </p>
          <CardTitle className="text-base">Where you stand</CardTitle>
        </div>
        <Link
          href="/dashboard/standings"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Full table <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {rows.length === 0 ? (
          <DashboardEmptyState kind="no-standings" className="border-none bg-transparent shadow-none" />
        ) : (
          <ul className="space-y-2.5">
            {rows.slice(0, 5).map((r) => (
              <li key={`${r.competitionId}-${r.teamId}`} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">{r.teamName}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {r.competitionName}
                  </p>
                </div>
                <div className="flex shrink-0 items-baseline gap-1.5 text-[11px]">
                  <span className="font-mono font-bold tabular-nums">
                    #{r.rank}
                  </span>
                  <span className="text-muted-foreground">of {r.totalTeams}</span>
                  {r.rank === 1 ? <Flame className="h-3 w-3 text-[color:var(--brand-gold)]" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Helpers -----------------------------------------------------------

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatMatchDate(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "Just now";
  const hours = ms / 3600000;
  if (hours < 24) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Reference exports to avoid unused-warning noise on icons reserved for
// future state visualizations
void CalendarDays;
