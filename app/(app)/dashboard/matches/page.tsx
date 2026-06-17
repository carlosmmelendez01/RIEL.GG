/**
 * Coach schedule view.
 *
 * Lists matches for the signed-in coach's school(s), with filters for
 * upcoming/past/all, season, match date, and team/opponent search.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Search, SlidersHorizontal } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { MatchStateMark, matchStatusToState } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadCoachSchedule,
  type CoachScheduleRow,
  type CoachScheduleView,
} from "@/lib/coach/dashboard";
import { cn } from "@/lib/utils";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    season?: string;
    date?: string;
    q?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/matches");

  const params = await searchParams;
  const view = normalizeView(params.view);
  const data = await loadCoachSchedule(user.id, {
    view,
    seasonId: params.season,
    date: params.date,
    q: params.q,
  });
  if (!data) {
    return (
      <>
        <Topbar title="Schedule" eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-school" />
        </main>
      </>
    );
  }

  if (data.teamsCount === 0) {
    return (
      <>
        <Topbar title="Schedule" eyebrow={data.schoolName} />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-teams" schoolName={data.schoolName} />
        </main>
      </>
    );
  }

  const groups = groupByDay(data.rows);

  return (
    <>
      <Topbar
        title="Schedule"
        eyebrow={`${data.schoolName} · ${data.rows.length} match${data.rows.length === 1 ? "" : "es"} shown`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-crimson)]">
                <SlidersHorizontal className="h-3 w-3" />
                Schedule filters
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Find the match you need
              </h1>
            </div>
            <ViewTabs active={data.filters.view} counts={data.counts} params={params} />
          </div>

          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_170px_auto]" method="get">
            <input type="hidden" name="view" value={data.filters.view} />
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Team or opponent
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={data.filters.q ?? ""}
                  placeholder="Search team, school, game..."
                  className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Season
              </span>
              <select
                name="season"
                defaultValue={data.filters.seasonId ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="">All seasons</option>
                {data.seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Date
              </span>
              <input
                type="date"
                name="date"
                defaultValue={data.filters.date ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
              >
                Apply
              </button>
              <Link
                href="/dashboard/matches"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border/60 px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                Clear
              </Link>
            </div>
          </form>
        </section>

        {data.rows.length === 0 ? (
          <DashboardEmptyState kind="no-matches" />
        ) : (
          <div className="space-y-6">
            {groups.map(([day, items]) => (
              <Card key={day} className="border-border/60 bg-card/80">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {day}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {items.length} match{items.length === 1 ? "" : "es"}
                  </p>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  <ul className="divide-y divide-border/40">
                    {items.map((match) => (
                      <li key={match.matchId}>
                        <ScheduleRow match={match} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function ViewTabs({
  active,
  counts,
  params,
}: {
  active: CoachScheduleView;
  counts: { upcoming: number; past: number; all: number };
  params: { season?: string; date?: string; q?: string };
}) {
  const tabs: Array<{ id: CoachScheduleView; label: string; count: number }> = [
    { id: "upcoming", label: "Upcoming", count: counts.upcoming },
    { id: "past", label: "Past", count: counts.past },
    { id: "all", label: "All", count: counts.all },
  ];
  return (
    <div className="flex rounded-lg border border-border/60 bg-background/40 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={hrefForView(tab.id, params)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
            active === tab.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}{" "}
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {tab.count}
          </span>
        </Link>
      ))}
    </div>
  );
}

function ScheduleRow({ match }: { match: CoachScheduleRow }) {
  return (
    <Link
      href={`/dashboard/matches/${match.matchId}`}
      className="grid gap-3 rounded-md px-3 py-3 transition-colors hover:bg-card md:grid-cols-[auto_1fr_auto]"
    >
      <div className="flex items-center gap-3">
        <MatchStateMark state={matchStatusToState(match.status)} size={18} />
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-bold text-white">
          {match.ownTeamMonogram}
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold">
          {match.ownTeamName} <span className="text-muted-foreground">vs</span>{" "}
          {match.opponentTeamName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatTime(match.scheduledAt)} · {match.competitionName} · {match.game}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {match.seasonName} · {match.isHome ? "Home" : "Away"}
        </p>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        {match.score ? (
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-[12px] font-bold tabular-nums",
              match.tone === "win" &&
                "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
              match.tone === "loss" &&
                "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
              match.tone !== "win" &&
                match.tone !== "loss" &&
                "border-border/60 bg-background/60 text-muted-foreground",
            )}
          >
            {match.score}
          </span>
        ) : null}
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            match.tone === "live"
              ? "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]"
              : "border-border/60 bg-background text-muted-foreground",
          )}
        >
          {match.status.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>
    </Link>
  );
}

function groupByDay(rows: CoachScheduleRow[]): Array<[string, CoachScheduleRow[]]> {
  const map = new Map<string, CoachScheduleRow[]>();
  for (const row of rows) {
    const key = row.scheduledAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return Array.from(map.entries());
}

function normalizeView(view: string | undefined): CoachScheduleView {
  if (view === "past" || view === "all") return view;
  return "upcoming";
}

function hrefForView(
  view: CoachScheduleView,
  params: { season?: string; date?: string; q?: string },
) {
  const search = new URLSearchParams();
  search.set("view", view);
  if (params.season) search.set("season", params.season);
  if (params.date) search.set("date", params.date);
  if (params.q) search.set("q", params.q);
  return `/dashboard/matches?${search.toString()}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
