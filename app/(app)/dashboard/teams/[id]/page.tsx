/**
 * Coach team detail.
 *
 * School-scoped via `loadCoachTeam` — only returns data when the viewer is
 * a COACH or MANAGER at the team's school. Anyone else (including players
 * on the roster) sees the out-of-scope card instead of a 404.
 *
 * The right column hosts `<TeamRosterManager>` — the registration picker +
 * per-roster player management. All mutations land via server actions in
 * lib/team/roster-actions.ts.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Users } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { TeamRosterManager } from "@/components/team/team-roster-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadCoachTeam,
  loadOpenCompetitionsForTeam,
} from "@/lib/coach/dashboard";

export default async function CoachTeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/teams/${id}`);

  const team = await loadCoachTeam(user.id, id);

  if (!team) {
    return (
      <>
        <Topbar title="Team not found" eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <Card className="border-dashed border-border/80 bg-card/40">
            <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
                <Trophy className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Out of scope
              </p>
              <h3 className="max-w-md text-balance text-xl font-semibold tracking-tight">
                This team isn&apos;t one of yours.
              </h3>
              <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
                Either the team doesn&apos;t exist or you aren&apos;t a coach / manager at its
                school. Only school coaches can manage roster registration.
              </p>
              <Link
                href="/dashboard/teams"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to teams
              </Link>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const openCompetitions = await loadOpenCompetitionsForTeam(team.id);

  return (
    <>
      <Topbar
        title={team.name}
        eyebrow={`${team.schoolName} · ${team.game} · ${team.tier.toLowerCase()}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Link
            href="/dashboard/teams"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            All teams
          </Link>
        </div>

        {/* Header card */}
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-5 md:p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[14px] font-bold tracking-tight text-white">
            {team.name
              .replace(/[^A-Za-z]/g, "")
              .slice(0, 3)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {team.name}
            </h1>
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">
              {team.game} · {team.tier.toLowerCase()}{" "}
              {team.archived ? " · archived" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
              <Users className="h-3 w-3" />
              {team.rosters.reduce((s, r) => s + r.members.length, 0)} players
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
              <Trophy className="h-3 w-3" />
              {team.rosters.length} roster{team.rosters.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>

        <TeamRosterManager team={team} openCompetitions={openCompetitions} />
      </main>
    </>
  );
}
