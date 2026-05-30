/**
 * Coach teams view.
 *
 * Lists every team at the signed-in coach's school(s) with real win/loss
 * records, roster sizes, and competition assignment. The previous "League
 * directory" cross-school section was removed as part of the multi-tenancy
 * sweep — coaches see other schools only via match contexts now.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, TrendingDown, TrendingUp, Users } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateTeamTrigger } from "@/components/team/create-team-trigger";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadCoachDashboard, getCoachSchools, type CoachTeamRow } from "@/lib/coach/dashboard";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/teams");

  const data = await loadCoachDashboard(user.id);
  if (!data) {
    return (
      <>
        <Topbar title="Teams" eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-school" />
        </main>
      </>
    );
  }

  // Game catalog + school list for the "New team" dialog
  const [schools, games] = await Promise.all([
    getCoachSchools(user.id),
    prisma.gameTitle.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);
  const dialogSchools = schools.map((s) => ({ id: s.id, name: s.name }));

  if (data.teams.length === 0) {
    return (
      <>
        <Topbar title="Teams" eyebrow={data.coach.schoolName} />
        <main className="flex-1 space-y-6 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-teams" schoolName={data.coach.schoolName} />
          <div className="flex justify-center">
            <CreateTeamTrigger schools={dialogSchools} games={games} />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Teams"
        eyebrow={`${data.coach.schoolName} · ${data.teams.length} active roster${data.teams.length === 1 ? "" : "s"}`}
      />

      <main className="flex-1 space-y-8 px-6 py-6 md:px-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Your teams
            </h2>
            <CreateTeamTrigger schools={dialogSchools} games={games} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function TeamCard({ team }: { team: CoachTeamRow }) {
  const totalGames = team.wins + team.losses;
  const winPct = totalGames > 0 ? team.wins / totalGames : 0;
  const isUnified = team.tier === "UNIFIED";

  return (
    <Link href={`/dashboard/teams/${team.id}`} className="block focus:outline-none">
      <CardInner team={team} winPct={winPct} isUnified={isUnified} />
    </Link>
  );
}

function CardInner({
  team,
  winPct,
  isUnified,
}: {
  team: CoachTeamRow;
  winPct: number;
  isUnified: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/80 ring-1 ring-[color:var(--brand-crimson)]/25 transition-all hover:-translate-y-0.5 hover:bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[11px] font-bold tracking-tight text-white">
            {team.name
              .replace(/[^A-Za-z]/g, "")
              .slice(0, 3)
              .toUpperCase()}
          </div>
          {isUnified ? (
            <Badge
              variant="outline"
              className="border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]"
            >
              Unified
            </Badge>
          ) : (
            <Badge variant="outline" className="border-border/60 text-muted-foreground">
              {team.tier.toLowerCase()}
            </Badge>
          )}
        </div>
        <CardTitle className="mt-3 text-sm font-semibold">{team.name}</CardTitle>
        <p className="text-xs text-muted-foreground">{team.game}</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">
            {team.wins}
            <span className="text-muted-foreground/50">–</span>
            {team.losses}
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {team.rosterSize}
            </span>
            {team.forfeits > 0 ? (
              <span className="inline-flex items-center gap-1 text-orange-500">
                <Flag className="h-3 w-3" />
                {team.forfeits}
              </span>
            ) : null}
            {team.streak !== 0 ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  team.streak > 0 ? "text-emerald-500" : "text-[color:var(--brand-crimson)]",
                )}
              >
                {team.streak > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(team.streak)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-[color:var(--brand-crimson)] transition-all"
            style={{ width: `${Math.round(winPct * 100)}%` }}
          />
        </div>
        {team.competitionName ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {team.competitionName}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
