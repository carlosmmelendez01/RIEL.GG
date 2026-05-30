/**
 * Board Dashboard — League-wide forfeit aggregates.
 *
 * Default landing for board members and platform admins. Shows hero metrics,
 * 8-week FF rate trend, FF rate by game, top forfeiting teams, and a recent
 * forfeit activity feed.
 *
 * Read-only for now. Forfeit-recording mutations come in slice 4; CSV/PDF
 * exports in slice 6; realtime in slice 7.
 *
 * All charts are inline SVG / CSS — no third-party chart deps.
 */

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Flag,
  GraduationCap,
  ListFilter,
  Percent,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { redirect } from "next/navigation";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadBoardData,
  TOP_FF_TEAMS,
  type ForfeitFeedItem,
  type GameRow,
  type ReasonRow,
  type RescheduleStats,
  type TopOffender,
  type TrendPoint,
} from "@/lib/board/data";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import { cn } from "@/lib/utils";

// --- Page ----------------------------------------------------------------

export const metadata = {
  title: "Board Dashboard",
  description: "League-wide forfeit aggregates and trends.",
};

export default async function BoardDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/board");

  // Gate by league admin role and scope the aggregates to THIS league only.
  // Previously /admin/board pulled forfeit data across every league in the
  // DB, which leaked one league's stats into another's admin view.
  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="Board dashboard" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const data = await loadBoardData(ctx.league.id);

  return (
    <>
      <AdminTopbar
        title="Board dashboard"
        eyebrow={`${ctx.league.name} · league-wide stats`}
      />

      <main className="flex-1 space-y-8 px-6 py-6 md:px-8">
        {/* Headline */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Snapshot for the last <span className="text-foreground">60 days</span>.
            </p>
            <h2 className="mt-1 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              {data.headline.ff > 0 ? (
                <>
                  <span className="text-[color:var(--brand-crimson)]">
                    {data.headline.ff}
                  </span>{" "}
                  forfeits across{" "}
                  <span className="text-foreground">{data.headline.matches}</span>{" "}
                  matches.
                </>
              ) : (
                <>The league is running clean — zero forfeits this period.</>
              )}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="rounded-md border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-purple)]">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Board view
            </span>
            <p className="text-[11px] text-muted-foreground">
              Auto-refreshes when forfeits are recorded
            </p>
          </div>
        </section>

        {/* Hero metrics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeroStat
            label="Total forfeits (30d)"
            value={String(data.headline.ff30)}
            sub={`${data.headline.ffAllTime} all-time`}
            icon={Flag}
            tone="crimson"
            delta={data.headline.ffDeltaPct}
            deltaInverse
          />
          <HeroStat
            label="Forfeit rate (30d)"
            value={`${data.headline.ffRate30.toFixed(1)}%`}
            sub={`${data.headline.ffRatePrior30.toFixed(1)}% prior 30d`}
            icon={Percent}
            delta={data.headline.ffRateDelta}
            deltaInverse
            deltaIsPercentPoints
          />
          <HeroStat
            label="Matches played (30d)"
            value={String(data.headline.matches30)}
            sub={`${data.headline.matches} total in 60d window`}
            icon={CalendarDays}
            delta={data.headline.matchesDeltaPct}
          />
          <HeroStat
            label="Repeat offenders"
            value={String(data.topOffenders.filter((t) => t.ff >= 3).length)}
            sub="Teams with 3+ forfeits"
            icon={ShieldAlert}
            tone="gold"
          />
        </section>

        {/* Trend + Game breakdown */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                      8-week trend
                    </p>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-[color:var(--brand-crimson)]" />
                      Forfeit rate over time
                    </CardTitle>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    % of finished matches that were forfeited, weekly
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-4">
                <TrendChart data={data.trend} />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  By game
                </p>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-[color:var(--brand-gold)]" />
                  Forfeit rate per title
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GameRateBars data={data.byGame} />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Reschedule rate + Reason breakdown — added by the forfeit workflow */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div>
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  Reschedule attempts
                </p>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-4 w-4 text-emerald-500" />
                  Coaches who tried first
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RescheduleRateCard stats={data.rescheduleStats} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                      Why coaches forfeit
                    </p>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ListFilter className="h-4 w-4 text-[color:var(--brand-purple)]" />
                      Reason breakdown
                    </CardTitle>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {data.headline.ff} forfeits in 60d window
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ReasonBreakdownList items={data.reasonBreakdown} />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Top offenders + Recent feed */}
        <section className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Card className="border-[color:var(--brand-crimson)]/20 bg-card/80">
              <CardHeader className="pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  Leaderboard
                </p>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-[color:var(--brand-crimson)]" />
                  Top forfeiting teams
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <TopOffendersTable items={data.topOffenders.slice(0, TOP_FF_TEAMS)} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                      Activity feed
                    </p>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Flag className="h-4 w-4 text-[color:var(--brand-crimson)]" />
                      Recent forfeits
                    </CardTitle>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {data.recent.length} of {data.headline.ff} in window
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <RecentForfeitsFeed items={data.recent} />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer note about exports / realtime — coming soon */}
        <section>
          <Card className="border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5">
            <CardContent className="flex items-start gap-3 p-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-purple)]" />
              <div className="text-[12px] text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Coming next on the board view
                </p>
                <p className="mt-1">
                  CSV + branded PDF export · realtime updates via Supabase
                  channels · drill-down by school/competition · historical
                  comparison across seasons.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}


// --- Subcomponents -------------------------------------------------------

function HeroStat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  delta = null,
  deltaInverse = false,
  deltaIsPercentPoints = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Flag;
  tone?: "default" | "crimson" | "gold";
  delta?: number | null;
  deltaInverse?: boolean;
  deltaIsPercentPoints?: boolean;
}) {
  const showDelta = delta !== null && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;
  // For "forfeits" metrics, an increase is bad → flip the color via deltaInverse.
  const goodDirection = deltaInverse ? !positive : positive;
  return (
    <Card className="hover-edge-crimson border-border/60 bg-card/80 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border",
            tone === "crimson" &&
              "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
            tone === "gold" &&
              "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
            tone === "default" && "border-border bg-background text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {showDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                goodDirection
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
              )}
            >
              {positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {positive ? "+" : ""}
              {delta!.toFixed(deltaIsPercentPoints ? 1 : 0)}
              {deltaIsPercentPoints ? "pp" : "%"}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </div>
    </Card>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const width = 720;
  const height = 200;
  const padding = { top: 16, right: 12, bottom: 32, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const rates = data.map((d) =>
    d.matches > 0 ? (d.ff / d.matches) * 100 : 0,
  );
  const maxRate = Math.max(...rates, 5) * 1.25;
  const yTicks = 4;

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = rates.map((r, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - (r / maxRate) * innerH,
    rate: r,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`
      : "";

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ffAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.4555 0.1734 19.27)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="oklch(0.4555 0.1734 19.27)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid + labels */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = padding.top + (innerH * i) / yTicks;
          const value = maxRate * (1 - i / yTicks);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="stroke-border/50"
                strokeDasharray={i === yTicks ? "0" : "2 4"}
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {value.toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* Area + line */}
        {points.length > 0 ? (
          <>
            <path d={areaPath} fill="url(#ffAreaGrad)" />
            <path
              d={linePath}
              fill="none"
              stroke="oklch(0.4555 0.1734 19.27)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3.5" fill="oklch(0.4555 0.1734 19.27)" />
                <circle cx={p.x} cy={p.y} r="1.5" fill="white" />
                {/* Hover-friendly invisible target */}
                <title>
                  Week of {data[i].weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {data[i].ff}/{data[i].matches} forfeited ({p.rate.toFixed(1)}%)
                </title>
              </g>
            ))}
          </>
        ) : null}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = padding.left + i * xStep;
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {d.weekStart.toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
              })}
            </text>
          );
        })}
      </svg>

      {/* Mini summary below the chart */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
        <span>
          Earliest week:{" "}
          <span className="font-mono text-foreground">
            {data[0]?.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[color:var(--brand-crimson)]" />
            Forfeit rate
          </span>
        </span>
        <span>
          Latest week:{" "}
          <span className="font-mono text-foreground">
            {data[data.length - 1]?.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </span>
      </div>
    </div>
  );
}

function GameRateBars({ data }: { data: GameRow[] }) {
  if (data.length === 0) {
    return (
      <p className="px-1 py-2 text-[12px] text-muted-foreground">No data yet.</p>
    );
  }
  const maxRate = Math.max(
    ...data.map((d) => (d.matches > 0 ? d.ff / d.matches : 0)),
    0.05,
  );
  return (
    <div className="space-y-3 py-1">
      {data.map((d) => {
        const rate = d.matches > 0 ? d.ff / d.matches : 0;
        const pct = maxRate > 0 ? (rate / maxRate) * 100 : 0;
        const hot = rate >= 0.2;
        return (
          <div key={d.game}>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="truncate font-medium">{d.game}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                <span className={cn("text-foreground", hot && "text-[color:var(--brand-crimson)]")}>
                  {(rate * 100).toFixed(1)}%
                </span>
                <span className="ml-1 text-[10px]">
                  ({d.ff}/{d.matches})
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all",
                  hot
                    ? "bg-[color:var(--brand-crimson)]"
                    : "bg-[color:var(--brand-gold)]",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopOffendersTable({ items }: { items: TopOffender[] }) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-4 text-[12px] text-muted-foreground">
        No teams have forfeited in the last 60 days.
      </p>
    );
  }
  const maxFf = Math.max(...items.map((i) => i.ff));
  return (
    <ul className="space-y-0.5">
      {items.map((t, i) => {
        const rate = t.matches > 0 ? (t.ff / t.matches) * 100 : 0;
        const widthPct = (t.ff / maxFf) * 100;
        return (
          <li
            key={t.teamId}
            className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-card"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[color:var(--brand-crimson)]/20 bg-[color:var(--brand-crimson)]/5 text-[11px] font-semibold tabular-nums text-[color:var(--brand-crimson)]">
              #{i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[13px] font-semibold">{t.teamName}</p>
                <span className="rounded-sm border border-border/60 px-1 py-0 text-[9px] uppercase tracking-wider text-muted-foreground">
                  {t.game}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 max-w-[140px] flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[color:var(--brand-crimson)]"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-mono tabular-nums text-[color:var(--brand-crimson)]">
                    {t.ff}
                  </span>{" "}
                  forfeit{t.ff === 1 ? "" : "s"} · {rate.toFixed(0)}% rate
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RecentForfeitsFeed({ items }: { items: ForfeitFeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-4 text-[12px] text-muted-foreground">
        No forfeits recorded in the last 60 days.
      </p>
    );
  }
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li
          key={item.matchId}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-card"
        >
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
            <Flag className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug">
              <span className="font-medium text-foreground">{item.forfeiterTeam}</span>
              <span className="text-muted-foreground">
                {item.partial ? " forfeited mid-match against " : " forfeited vs "}
              </span>
              <span className="font-medium text-foreground">{item.opponentTeam}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {item.competition}
              </span>
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              {timeAgo(item.when)}
              {item.reason ? (
                <>
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  <span className="italic">"{item.reason}"</span>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// --- RescheduleRateCard --------------------------------------------------

function RescheduleRateCard({ stats }: { stats: RescheduleStats }) {
  const { totalForfeits, attempted, notAttempted, unknown, attemptedRate } = stats;
  const known = attempted + notAttempted;
  const tone =
    attemptedRate >= 70 ? "emerald" : attemptedRate >= 40 ? "gold" : "crimson";

  if (totalForfeits === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-muted-foreground">
        No forfeits in window.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p
          className={cn(
            "text-4xl font-bold tracking-tight tabular-nums",
            tone === "emerald" && "text-emerald-500",
            tone === "gold" && "text-[color:var(--brand-gold)]",
            tone === "crimson" && "text-[color:var(--brand-crimson)]",
          )}
        >
          {attemptedRate.toFixed(0)}%
        </p>
        <p className="text-[11px] text-muted-foreground">
          {attempted} of {known} tried
        </p>
      </div>

      {/* Segmented bar */}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
        {attempted > 0 ? (
          <div
            className="bg-emerald-500"
            style={{ width: `${(attempted / totalForfeits) * 100}%` }}
            title={`${attempted} attempted`}
          />
        ) : null}
        {notAttempted > 0 ? (
          <div
            className="bg-[color:var(--brand-crimson)]"
            style={{ width: `${(notAttempted / totalForfeits) * 100}%` }}
            title={`${notAttempted} did not attempt`}
          />
        ) : null}
        {unknown > 0 ? (
          <div
            className="bg-muted-foreground/30"
            style={{ width: `${(unknown / totalForfeits) * 100}%` }}
            title={`${unknown} legacy / unknown`}
          />
        ) : null}
      </div>

      <ul className="mt-4 space-y-1.5 text-[12px]">
        <li className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Attempted
          </span>
          <span className="font-mono tabular-nums">{attempted}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[color:var(--brand-crimson)]" /> Did not try
          </span>
          <span className="font-mono tabular-nums">{notAttempted}</span>
        </li>
        {unknown > 0 ? (
          <li className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Legacy
            </span>
            <span className="font-mono tabular-nums">{unknown}</span>
          </li>
        ) : null}
      </ul>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        High rate = scheduler is the bottleneck. Low rate = training opportunity.
      </p>
    </div>
  );
}

// --- ReasonBreakdownList -------------------------------------------------

const REASON_LABEL: Record<string, string> = {
  OPPONENT_NO_SHOW: "Opponent no-show",
  SCHEDULING_CONFLICT: "Scheduling conflict",
  INSUFFICIENT_ROSTER: "Insufficient roster",
  TECHNICAL_ISSUES: "Technical issues",
  PLAYER_ILLNESS: "Player illness / emergency",
  ELIGIBILITY_ISSUE: "Eligibility issue",
  WEATHER_TRAVEL: "Weather / travel",
  OPPONENT_CONDUCT: "Opponent conduct",
  OTHER: "Other",
  UNKNOWN: "Legacy / unknown",
};

const REASON_TONE: Record<string, string> = {
  OPPONENT_NO_SHOW: "bg-[color:var(--brand-crimson)]",
  SCHEDULING_CONFLICT: "bg-[color:var(--brand-gold)]",
  INSUFFICIENT_ROSTER: "bg-[color:var(--brand-purple)]",
  TECHNICAL_ISSUES: "bg-sky-500",
  PLAYER_ILLNESS: "bg-emerald-500",
  ELIGIBILITY_ISSUE: "bg-fuchsia-500",
  WEATHER_TRAVEL: "bg-amber-500",
  OPPONENT_CONDUCT: "bg-rose-500",
  OTHER: "bg-zinc-500",
  UNKNOWN: "bg-muted-foreground/40",
};

function ReasonBreakdownList({ items }: { items: ReasonRow[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-muted-foreground">
        No forfeits recorded in the last 60 days.
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.count));

  return (
    <ul className="space-y-3">
      {items.map((row) => {
        const widthPct = max > 0 ? (row.count / max) * 100 : 0;
        const reasonKey = row.reason ?? "UNKNOWN";
        return (
          <li key={reasonKey} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium">{REASON_LABEL[reasonKey] ?? reasonKey}</span>
              <div className="flex items-baseline gap-2 font-mono text-[12px]">
                <span className="tabular-nums">{row.count}</span>
                <span className="text-muted-foreground">·</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.pct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all", REASON_TONE[reasonKey] ?? "bg-zinc-500")}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- Helpers -------------------------------------------------------------

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
