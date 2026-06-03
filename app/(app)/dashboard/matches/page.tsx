/**
 * Coach schedule view.
 *
 * Lists upcoming + recent matches for the signed-in coach's school(s) only.
 * Empty-state cascade matches the dashboard root: no school → onboarding,
 * has school but no teams → register-teams CTA, has teams but no matches →
 * scheduler-coming-soon callout.
 */

import { redirect } from "next/navigation";
import Link from "next/link";

import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { MatchStateMark, matchStatusToState } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadCoachDashboard } from "@/lib/coach/dashboard";
import { cn } from "@/lib/utils";

export default async function MatchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/matches");

  const data = await loadCoachDashboard(user.id);
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

  if (data.teams.length === 0) {
    return (
      <>
        <Topbar title="Schedule" eyebrow={data.coach.schoolName} />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-teams" schoolName={data.coach.schoolName} />
        </main>
      </>
    );
  }

  // Merge upcoming + recent into a single chronological flow, then group by day
  const allRows = [
    ...data.upcomingMatches.map((m) => ({
      key: m.matchId,
      when: m.scheduledAt,
      status: m.status,
      ownTeam: m.ownTeamName,
      opponent: m.opponentTeamName,
      game: m.game,
      competitionName: m.competitionName,
      score: null as string | null,
      tone: "upcoming" as const,
    })),
    ...data.recentResults.map((r) => ({
      key: r.matchId,
      when: r.finishedAt,
      status: r.isForfeit ? "FORFEITED" : "FINISHED",
      ownTeam: data.coach.schoolShortName ?? data.coach.schoolName,
      opponent: r.opponentTeamName,
      game: r.game,
      competitionName: "—",
      score:
        r.ourScore !== null && r.theirScore !== null
          ? `${r.ourScore}–${r.theirScore}`
          : null,
      tone: (r.isWin ? "win" : "loss") as "win" | "loss",
    })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  const groups = groupByDay(allRows);

  return (
    <>
      <Topbar
        title="Schedule"
        eyebrow={`${data.coach.schoolName} · ${data.teams.length} team${data.teams.length === 1 ? "" : "s"}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">{data.upcomingMatches.length}</span> upcoming ·{" "}
            <span className="text-foreground">{data.recentResults.length}</span> recent results
          </p>
        </div>

        {allRows.length === 0 ? (
          <DashboardEmptyState kind="no-matches" />
        ) : (
          <div className="space-y-6">
            {groups.map(([day, items]) => (
              <Card key={day} className="border-border/60 bg-card/80">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {day}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {items.length} match{items.length === 1 ? "" : "es"}
                  </p>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  <ul className="divide-y divide-border/40">
                    {items.map((m) => (
                      <li key={m.key}>
                        <Link
                          href={`/dashboard/matches/${m.key}`}
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-card"
                        >
                          <MatchStateMark state={matchStatusToState(m.status)} size={18} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">
                              {m.ownTeam}{" "}
                              <span className="text-muted-foreground">vs</span>{" "}
                              {m.opponent}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {m.when.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}{" "}
                              · {m.competitionName}
                            </p>
                          </div>
                          {m.score ? (
                            <span
                              className={cn(
                                "rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums",
                                m.tone === "win"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                                  : "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
                              )}
                            >
                              {m.score}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {m.game}
                          </span>
                        </Link>
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

type MatchRowShape = {
  key: string;
  when: Date;
  status: string;
  ownTeam: string;
  opponent: string;
  game: string;
  competitionName: string;
  score: string | null;
  tone: "upcoming" | "win" | "loss";
};

function groupByDay(rows: MatchRowShape[]): Array<[string, MatchRowShape[]]> {
  const map = new Map<string, MatchRowShape[]>();
  for (const r of rows) {
    const key = r.when.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries());
}
