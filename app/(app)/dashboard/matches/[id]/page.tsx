/**
 * Coach match detail.
 *
 * School-scoped: the page only renders if the match exists AND one of the
 * rosters belongs to the signed-in coach's school. If not, an empty state
 * explains why instead of throwing a 404 (which would feel like a bug).
 *
 * The lineup card is built from real RosterMembership data — no more
 * `MOCK_LINEUPS` table. ForfeitTrigger receives the real `matchId` and the
 * real own-team label, so submitting actually hits the DB row.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Flag,
  Trophy,
  Users,
} from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ForfeitTrigger } from "@/components/match/forfeit-trigger";
import { MatchReportingPanel } from "@/components/match/match-reporting-panel";
import { MatchStateMark, matchStatusToState } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadCoachMatch, type CoachMatchDetail } from "@/lib/coach/dashboard";
import { cn } from "@/lib/utils";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/matches/${id}`);

  const match = await loadCoachMatch(user.id, id);

  if (!match) {
    return (
      <>
        <Topbar title="Match not found" eyebrow="Coach view" />
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
                This match isn&apos;t one of yours.
              </h3>
              <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
                Either the match doesn&apos;t exist or your school doesn&apos;t have a roster on it.
                Coaches only see match details for their own school&apos;s matches.
              </p>
              <Link
                href="/dashboard/matches"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to schedule
              </Link>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const stateName = matchStatusToState(match.status);
  const isFinished = match.status === "FINISHED" || match.status === "FORFEITED";
  const ourScore = match.side === "HOME" ? match.homeScore : match.awayScore;
  const theirScore = match.side === "HOME" ? match.awayScore : match.homeScore;
  const weWon =
    isFinished && ourScore !== null && theirScore !== null && ourScore > theirScore;

  return (
    <>
      <Topbar
        title={`${match.ownTeam.schoolShort} vs ${match.opponentTeam.schoolShort}`}
        eyebrow={`${match.competitionName} · ${match.game}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        {/* Match header */}
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <MatchStateMark state={stateName} size={16} />
            <span className="font-bold uppercase tracking-wider">
              {labelForStatus(match.status)}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {match.scheduledAt.toLocaleString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px]">
              Best of {match.bestOf}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Monogram tone="crimson" text={match.ownTeam.monogram} size={56} />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold leading-tight">
                  {match.ownTeam.name}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  You · {match.ownTeam.schoolShort}
                </p>
              </div>
            </div>

            <div className="text-center">
              {isFinished && ourScore !== null && theirScore !== null ? (
                <>
                  <p className="font-mono text-4xl font-bold tabular-nums">
                    {ourScore}
                    <span className="px-2 text-muted-foreground/40">–</span>
                    {theirScore}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[10px] font-bold uppercase tracking-wider",
                      match.isForfeit
                        ? "text-orange-500"
                        : weWon
                          ? "text-emerald-500"
                          : "text-[color:var(--brand-crimson)]",
                    )}
                  >
                    {match.isForfeit ? "Forfeit" : weWon ? "Win" : "Loss"}
                  </p>
                </>
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  vs
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 justify-end min-w-0 text-right">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold leading-tight">
                  {match.opponentTeam.name}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Opponent · {match.opponentTeam.schoolShort}
                </p>
              </div>
              <Monogram tone="zinc" text={match.opponentTeam.monogram} size={56} />
            </div>
          </div>
        </section>

        {/* Two-col content */}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <MatchReportingPanel match={match} />

            <LineupCard match={match} />

            <ForfeitTrigger
              matchId={match.id}
              side={match.side}
              ownTeamLabel={match.ownTeam.name}
              opponentTeamLabel={match.opponentTeam.name}
              opponentCoachEmail={null}
              alreadyForfeited={match.isForfeit}
            />
          </div>

          <div className="space-y-6">
            <MatchMetaCard match={match} />
          </div>
        </div>
      </main>
    </>
  );
}

// --- Subcomponents ------------------------------------------------------

function LineupCard({ match }: { match: CoachMatchDetail }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Your lineup
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-[color:var(--brand-crimson)]" />
          {match.ownTeam.name}
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            {match.ownTeam.lineup.length} player{match.ownTeam.lineup.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {match.ownTeam.lineup.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            No players assigned to this roster yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {match.ownTeam.lineup.map((p) => {
              const isLead = p.role === "CAPTAIN" || p.role === "COACH" || p.role === "MANAGER";
              return (
                <li key={p.userId} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-card">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[10px] font-semibold text-white">
                      {p.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((s) => s[0]?.toUpperCase() ?? "")
                        .join("") || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {p.name}
                      {isLead ? (
                        <Crown className="ml-1 inline h-3 w-3 text-[color:var(--brand-gold)]" />
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.role.toLowerCase()}
                      {p.inGameName ? (
                        <>
                          {" · "}
                          <span className="font-mono text-foreground/80">{p.inGameName}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {p.jerseyNumber !== null ? (
                    <span className="font-mono text-[12px] font-bold tabular-nums text-muted-foreground">
                      #{p.jerseyNumber}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MatchMetaCard({ match }: { match: CoachMatchDetail }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Details
        </p>
        <CardTitle className="text-base">Match info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[13px]">
        <Row label="Competition" value={match.competitionName} />
        <Row label="Game" value={match.game} />
        <Row label="Format" value={`Best of ${match.bestOf}`} />
        <Row label="Side" value={match.side === "HOME" ? "Home" : "Away"} />
        {match.isForfeit ? (
          <Row
            label="Forfeit"
            value={
              <span className="inline-flex items-center gap-1 text-orange-500">
                <Flag className="h-3 w-3" />
                Recorded
              </span>
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Monogram({ tone, text, size = 40 }: { tone: "crimson" | "zinc"; text: string; size?: number }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold tracking-tight text-white",
        tone === "crimson"
          ? "from-[color:var(--brand-crimson)] to-rose-700"
          : "from-zinc-700 to-zinc-900",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
    >
      {text}
    </div>
  );
}

function labelForStatus(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "Live";
    case "CHECKING_IN":
      return "Checking in";
    case "AWAITING_CONFIRMATION":
      return "Awaiting confirmation";
    case "SCHEDULED":
      return "Scheduled";
    case "FINISHED":
      return "Finished";
    case "FORFEITED":
      return "Forfeited";
    case "CANCELED":
      return "Canceled";
    case "DISPUTED":
      return "Disputed";
    default:
      return status.replace(/_/g, " ").toLowerCase();
  }
}
