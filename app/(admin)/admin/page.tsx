/**
 * League admin command center.
 *
 * Real-data refactor — every metric, list, and feed on this page is now
 * scoped to the signed-in admin's league. Pulls from `loadLeagueAdminDashboard`
 * which gates on `requireLeagueAdmin(userId)` first. Non-admins see the
 * "no-admin" empty state instead of mock Carmel data.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CalendarPlus,
  CircleAlert,
  Flag,
  Percent,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { type BoardSummary } from "@/lib/board/data";
import {
  loadLeagueAdminDashboard,
  type LeagueAdminDashboardData,
  type LeagueActivityEntry,
  type LeagueCompetition,
  type LeagueDispute,
} from "@/lib/league-admin/dashboard";
import { cn } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");

  const data = await loadLeagueAdminDashboard(user.id);

  // 1. Not a league admin anywhere → restricted empty state
  if (!data) {
    return (
      <>
        <AdminTopbar title="Command center" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const { ctx, counts, competitions, disputes, recentActivity } = data;

  // 2. Has admin context but the league has no schools yet → onboarding state
  if (counts.memberSchools === 0) {
    return (
      <>
        <AdminTopbar
          title={`${ctx.league.shortName} command center`}
          eyebrow={`${ctx.league.name} · ${ctx.admin.role.toLowerCase()}`}
        />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-schools" leagueName={ctx.league.name} />
        </main>
      </>
    );
  }

  // MVP: the league-wide board snapshot (analytics) is out of scope, so it's
  // never rendered on the dashboard. Re-enable by restoring the loadBoardSummary
  // call — see git history.
  const boardSummary: BoardSummary | null = null;

  return (
    <>
      <AdminTopbar
        title={`${ctx.league.shortName} command center`}
        eyebrow={`${ctx.league.name} · Spring 2026 · ${ctx.admin.role.toLowerCase()}`}
      />

      <main className="flex-1 space-y-8 px-6 py-6 md:px-8">
        {/* Greeting + headline */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Welcome back, <span className="text-foreground">{ctx.admin.name}</span>.
            </p>
            <h2 className="mt-1 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              <Headline counts={counts} />
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/scheduler"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/8 text-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold)]/15",
              )}
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Run AI Scheduler
            </Link>
            <Link
              href="/admin/competitions/new"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
              )}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Competition
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Member schools"
            value={String(counts.memberSchools)}
            sub={
              counts.pendingSchoolApplications > 0
                ? `${counts.pendingSchoolApplications} pending applications`
                : "Open for new applications"
            }
            icon={Building2}
          />
          <StatCard
            label="Active competitions"
            value={String(counts.activeCompetitions)}
            sub={`${counts.draftCompetitions} in draft`}
            icon={Trophy}
            tone="crimson"
          />
          <StatCard
            label="Teams registered"
            value={`${counts.teamsRegistered}/${Math.max(counts.expectedTeams, counts.teamsRegistered)}`}
            sub={`${
              counts.expectedTeams > 0
                ? Math.round((counts.teamsRegistered / counts.expectedTeams) * 100)
                : 100
            }% of expected slots`}
            icon={Users}
          />
          <StatCard
            label="Matches this week"
            value={String(counts.matchesThisWeek)}
            sub={`${counts.activePlayers} active players`}
            icon={Calendar}
            tone="gold"
          />
        </section>

        {/* Board snapshot — gated by canView.board */}
        {boardSummary ? <BoardSnapshotSection summary={boardSummary} /> : null}

        {/* Two-column action area */}
        <section className="grid gap-6 lg:grid-cols-2">
          <PendingApplicationsCard count={counts.pendingSchoolApplications} />
          <DisputesCard disputes={disputes} />
        </section>

        {/* Competitions overview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Active competitions
            </h3>
            <Link
              href="/admin/competitions"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              All competitions
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {competitions.length === 0 ? (
            <LeagueAdminEmptyState kind="no-competitions" leagueName={ctx.league.name} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {competitions.map((c) => (
                <CompetitionCard key={c.id} comp={c} />
              ))}
            </div>
          )}
        </section>

        {/* Activity + Quick Actions */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ActivityFeedCard items={recentActivity} />
          </div>
          <div>
            <QuickActionsCard leagueShort={ctx.league.shortName} />
          </div>
        </section>
      </main>
    </>
  );
}

// --- Headline -----------------------------------------------------------

function Headline({ counts }: { counts: LeagueAdminDashboardData["counts"] }) {
  if (counts.openDisputes > 0 && counts.pendingSchoolApplications > 0) {
    return (
      <>
        <span className="text-[color:var(--brand-crimson)]">{counts.openDisputes}</span>{" "}
        dispute{counts.openDisputes === 1 ? "" : "s"} and{" "}
        <span className="text-[color:var(--brand-gold)]">{counts.pendingSchoolApplications}</span>{" "}
        application{counts.pendingSchoolApplications === 1 ? "" : "s"} need your call.
      </>
    );
  }
  if (counts.openDisputes > 0) {
    return (
      <>
        <span className="text-[color:var(--brand-crimson)]">{counts.openDisputes}</span>{" "}
        dispute{counts.openDisputes === 1 ? "" : "s"} waiting for your call.
      </>
    );
  }
  if (counts.pendingSchoolApplications > 0) {
    return (
      <>
        <span className="text-[color:var(--brand-gold)]">{counts.pendingSchoolApplications}</span>{" "}
        application{counts.pendingSchoolApplications === 1 ? "" : "s"} ready to review.
      </>
    );
  }
  return <>The league is running clean.</>;
}

// --- StatCard -----------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Building2;
  tone?: "default" | "crimson" | "gold";
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border",
            tone === "crimson" &&
              "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
            tone === "gold" &&
              "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
            tone === "default" && "border-border bg-background text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

// --- Pending Applications + Disputes ------------------------------------

function PendingApplicationsCard({ count }: { count: number }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Approval queue
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4 text-[color:var(--brand-gold)]" />
          School applications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <UserCheck className="mx-auto h-5 w-5 text-emerald-500" />
            <p className="mt-2 text-[13px] font-semibold">No pending applications.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              When a school applies via{" "}
              <span className="font-mono">/join</span>, you&apos;ll review and approve them on
              the Schools page.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[13px]">
              <span className="font-semibold text-foreground">{count}</span> school
              {count === 1 ? "" : "s"} waiting on your review.
            </p>
            <Link
              href="/admin/schools"
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-gold)] px-3 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-[color:var(--brand-gold)]/90"
            >
              Review applications
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DisputesCard({ disputes }: { disputes: LeagueDispute[] }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Disputes
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <CircleAlert className="h-4 w-4 text-[color:var(--brand-crimson)]" />
          Match disputes — needs your call
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {disputes.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-emerald-500" />
            <p className="mt-2 text-[13px] font-semibold">No open disputes.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Clean week — no unresolved score or eligibility issues from coaches.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {disputes.slice(0, 4).map((d) => (
              <li key={d.matchId} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">
                      {d.homeTeam} vs {d.awayTeam}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.game} · {d.competition}
                    </p>
                  </div>
                  <span className="rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-crimson)]">
                    Disputed
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    Raised by{" "}
                    <span className="font-medium text-foreground">
                      {d.raisedByName ?? "—"}
                    </span>{" "}
                    · {timeAgo(d.raisedAt)}
                  </span>
                  <Link
                    href={`/admin/matches/${d.matchId}`}
                    className="inline-flex items-center gap-0.5 font-medium text-[color:var(--brand-crimson)] hover:underline"
                  >
                    Open review
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Competition card --------------------------------------------------

function CompetitionCard({ comp }: { comp: LeagueCompetition }) {
  const fillPct = comp.expectedTeams > 0 ? Math.round((comp.registeredTeams / comp.expectedTeams) * 100) : 0;
  const matchProgressPct =
    comp.matchesTotal > 0 ? Math.round((comp.matchesPlayed / comp.matchesTotal) * 100) : 0;

  return (
    <Card
      className={cn(
        "group hover-edge-crimson border-border/60 bg-card/80 transition-colors hover:bg-card",
        comp.state === "ACTIVE" && comp.status === "IN_PROGRESS" && "edge-crimson",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {comp.tier}
            </p>
            <CardTitle className="mt-1.5 truncate text-[17px] font-semibold tracking-tight">
              {comp.name}
            </CardTitle>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              comp.state === "ACTIVE" && comp.status === "IN_PROGRESS"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : comp.state === "DRAFT"
                  ? "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]"
                  : "border-border bg-muted text-muted-foreground",
            )}
          >
            {comp.state === "ACTIVE" && comp.status === "IN_PROGRESS"
              ? "Live"
              : comp.state.toLowerCase()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-muted-foreground">Slots filled</span>
          <span className="font-mono font-semibold tabular-nums">
            {comp.registeredTeams}/{comp.expectedTeams}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-[color:var(--brand-crimson)] transition-all"
            style={{ width: `${Math.min(100, fillPct)}%` }}
          />
        </div>
        {comp.matchesTotal > 0 ? (
          <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
            <span>{comp.game}</span>
            <span className="font-mono tabular-nums">
              {comp.matchesPlayed}/{comp.matchesTotal} matches · {matchProgressPct}%
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">{comp.game}</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Activity feed -----------------------------------------------------

const ACTION_LABEL: Record<string, { label: string; tone: string }> = {
  "MATCH.FORFEIT_SUBMIT": { label: "Forfeit submitted", tone: "crimson" },
  "MATCH.FORFEIT_ADMIN_OVERRIDE": { label: "Admin forfeit override", tone: "crimson" },
  "MATCH.SCORE_REPORT": { label: "Score reported", tone: "emerald" },
  "MATCH.SCORE_CONFIRM": { label: "Score confirmed", tone: "emerald" },
  "MATCH.DISPUTE": { label: "Dispute raised", tone: "crimson" },
  "SCHOOL.JOIN": { label: "School joined", tone: "purple" },
  "SCHOOL.APPROVE": { label: "School approved", tone: "emerald" },
  "COMPETITION.CREATE": { label: "Competition created", tone: "gold" },
  "ROSTER.CREATE": { label: "Roster created", tone: "gold" },
};

function ActivityFeedCard({ items }: { items: LeagueActivityEntry[] }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Activity
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-[color:var(--brand-purple)]" />
          Recent league actions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[13px] font-semibold">No recent activity.</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Match results, school approvals, and admin actions will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const meta = ACTION_LABEL[item.action] ?? {
                label: item.action.replace(/[._]/g, " ").toLowerCase(),
                tone: "muted",
              };
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-card"
                >
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                      meta.tone === "crimson" &&
                        "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
                      meta.tone === "emerald" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                      meta.tone === "purple" &&
                        "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
                      meta.tone === "gold" &&
                        "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
                      meta.tone === "muted" && "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {meta.label}
                      {item.actorName ? (
                        <>
                          {" "}
                          <span className="text-muted-foreground">
                            by {item.actorName}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.entityType} · {timeAgo(item.when)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Quick Actions -----------------------------------------------------

function QuickActionsCard({ leagueShort }: { leagueShort: string }) {
  const ACTIONS: Array<{ icon: typeof Plus; label: string; href: string; tone?: "crimson" }> = [
    { icon: Plus, label: "New competition", href: "/admin/competitions/new", tone: "crimson" },
    { icon: CalendarPlus, label: "Generate schedules", href: "/admin/scheduler" },
    { icon: UserPlus, label: "Review schools", href: "/admin/schools" },
  ];

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Quick actions
        </p>
        <CardTitle className="text-base">{leagueShort} shortcuts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-2 pb-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-card"
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                a.tone === "crimson"
                  ? "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]"
                  : "border-border bg-background",
              )}
            >
              <a.icon className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-[13px] font-medium">{a.label}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Board snapshot ribbon (unchanged from prior pass) -----------------

function BoardSnapshotSection({ summary }: { summary: BoardSummary }) {
  const { headline, repeatOffenderCount } = summary;
  return (
    <section>
      <Link
        href="/admin/board"
        className="group block rounded-xl border border-[color:var(--brand-purple)]/25 bg-card/60 p-3 transition-colors hover:border-[color:var(--brand-purple)]/45 hover:bg-card md:p-4"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                Board snapshot
              </p>
              <p className="text-[11px] text-muted-foreground">Last 30 days</p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
            <InlineMetric
              icon={Flag}
              label="Forfeits"
              value={String(headline.ff30)}
              tone="crimson"
              delta={
                headline.ffDeltaPct !== null
                  ? { value: headline.ffDeltaPct, deltaInverse: true, kind: "percent" }
                  : null
              }
            />
            <InlineMetric
              icon={Percent}
              label="FF rate"
              value={`${headline.ffRate30.toFixed(1)}%`}
              delta={{ value: headline.ffRateDelta, deltaInverse: true, kind: "pp" }}
            />
            <InlineMetric
              icon={ShieldAlert}
              label="Repeat offenders"
              value={String(repeatOffenderCount)}
              tone="gold"
            />
          </div>

          <div className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            Full board view
            <ArrowUpRight className="h-3 w-3" />
          </div>
        </div>
      </Link>
    </section>
  );
}

function InlineMetric({
  icon: Icon,
  label,
  value,
  tone = "default",
  delta = null,
}: {
  icon: typeof Flag;
  label: string;
  value: string;
  tone?: "default" | "crimson" | "gold";
  delta?: { value: number; deltaInverse?: boolean; kind: "percent" | "pp" } | null;
}) {
  const showDelta = delta && Number.isFinite(delta.value);
  const positive = (delta?.value ?? 0) >= 0;
  const goodDirection = delta?.deltaInverse ? !positive : positive;
  return (
    <div className="flex items-baseline gap-1.5">
      <Icon
        className={cn(
          "h-3 w-3 self-center",
          tone === "crimson" && "text-[color:var(--brand-crimson)]",
          tone === "gold" && "text-[color:var(--brand-gold)]",
          tone === "default" && "text-muted-foreground",
        )}
      />
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
      {showDelta ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-semibold",
            goodDirection
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
          )}
        >
          {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {positive ? "+" : ""}
          {delta.value.toFixed(delta.kind === "pp" ? 1 : 0)}
          {delta.kind === "pp" ? "pp" : "%"}
        </span>
      ) : null}
    </div>
  );
}

// --- Helpers ------------------------------------------------------------

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}
