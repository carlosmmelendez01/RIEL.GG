/**
 * League admin match detail.
 *
 * Scope-gated at the league level: the match must belong to a competition
 * in the admin's league. Out-of-scope or unknown ids show an empty state
 * instead of throwing a 404 — same UX promise we made on the coach side.
 *
 * Admin overrides (force score, mark disputed, override status, revert
 * forfeit) are wired via `<AdminMatchOverrides>`, which opens a per-action
 * modal that calls into `lib/match/admin-actions`.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Flag,
  History,
  ScrollText,
  Trophy,
  Users,
} from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MatchStateMark, matchStatusToState } from "@/components/brand/logo";
import { ForfeitTrigger } from "@/components/match/forfeit-trigger";
import { AdminMatchOverrides } from "@/components/match/admin-overrides";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadLeagueMatchDetail,
  requireLeagueAdmin,
  type LeagueMatchDetail,
  type TeamAdminView,
} from "@/lib/league-admin/dashboard";
import { cn } from "@/lib/utils";

export default async function AdminMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/admin/matches/${id}`);

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="Match" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <OutOfScopeCard
            title="You're not a league admin."
            body="Only league owners, admins, and staff can review matches. If you think this is wrong, ask your league owner to add you."
          />
        </main>
      </>
    );
  }

  const match = await loadLeagueMatchDetail(ctx.league.id, id);
  if (!match) {
    return (
      <>
        <AdminTopbar title="Match not found" eyebrow={ctx.league.name} />
        <main className="flex-1 px-6 py-12 md:px-8">
          <OutOfScopeCard
            title="This match isn't in your league."
            body="Either the match doesn't exist or it belongs to a different league. Admins only see match details for competitions inside the league they run."
          />
        </main>
      </>
    );
  }

  const stateName = matchStatusToState(match.status);
  const finished = match.status === "FINISHED" || match.status === "FORFEITED";

  return (
    <>
      <AdminTopbar
        title={`${match.home.schoolShort} vs ${match.away.schoolShort}`}
        eyebrow={`${ctx.league.name} · ${match.competition} · ${match.game}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <BreadcrumbRow />

        <MatchHeader match={match} stateName={stateName} />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <MatchReportsCard match={match} finished={finished} />

            <div className="grid gap-6 md:grid-cols-2">
              <LineupCard side="Home" team={match.home} />
              <LineupCard side="Away" team={match.away} />
            </div>

            <AdminMatchOverrides
              match={{
                id: match.id,
                status: match.status,
                isForfeit: match.isForfeit,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                homeTeamLabel: match.home.teamName,
                awayTeamLabel: match.away.teamName,
              }}
            />

            <ForfeitTrigger
              matchId={match.id}
              side="HOME"
              ownTeamLabel={match.home.teamName}
              opponentTeamLabel={match.away.teamName}
              opponentCoachEmail={null}
              alreadyForfeited={match.isForfeit}
            />
          </div>

          <div className="space-y-6">
            <MatchMetaCard match={match} />
            <MatchAuditCard entries={match.matchAuditEntries} />
          </div>
        </div>
      </main>
    </>
  );
}

// --- Subcomponents -----------------------------------------------------

function BreadcrumbRow() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Link
        href="/admin/matches"
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All matches
      </Link>
    </div>
  );
}

function MatchHeader({
  match,
  stateName,
}: {
  match: LeagueMatchDetail;
  stateName: ReturnType<typeof matchStatusToState>;
}) {
  const finished = match.status === "FINISHED" || match.status === "FORFEITED";
  return (
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
        <TeamSummary team={match.home} side="Home" tone="crimson" />

        <div className="text-center">
          {finished && match.homeScore !== null && match.awayScore !== null ? (
            <>
              <p className="font-mono text-4xl font-bold tabular-nums">
                {match.homeScore}
                <span className="px-2 text-muted-foreground/40">–</span>
                {match.awayScore}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {match.isForfeit ? "Forfeit" : "Final"}
              </p>
            </>
          ) : (
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              vs
            </p>
          )}
        </div>

        <TeamSummary team={match.away} side="Away" tone="zinc" align="right" />
      </div>
    </section>
  );
}

function TeamSummary({
  team,
  side,
  tone,
  align = "left",
}: {
  team: TeamAdminView;
  side: string;
  tone: "crimson" | "zinc";
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 min-w-0",
        align === "right" && "justify-end text-right",
      )}
    >
      {align === "left" ? <Monogram tone={tone} text={team.monogram} /> : null}
      <div className="min-w-0">
        <p className="truncate text-[16px] font-semibold leading-tight">{team.teamName}</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {side} · {team.schoolShort}
        </p>
      </div>
      {align === "right" ? <Monogram tone={tone} text={team.monogram} /> : null}
    </div>
  );
}

function MatchReportsCard({
  match,
  finished,
}: {
  match: LeagueMatchDetail;
  finished: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Reporting
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-[color:var(--brand-purple)]" />
          Match reports
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {match.reports.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[13px] font-semibold">No reports submitted yet.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {finished
                ? "Coaches haven't filed a report. Use admin override below to record the final score."
                : "Coaches will submit a final score after the match wraps. You'll see it here for confirmation."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {match.reports.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border/60 bg-background/40 p-3 text-[12px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {r.reportedByName}{" "}
                    <span className="text-muted-foreground">
                      ({r.reportedByTeam.toLowerCase()})
                    </span>
                  </p>
                  <span className="font-mono font-bold tabular-nums">
                    {r.homeScore}–{r.awayScore}
                  </span>
                </div>
                {r.notes ? (
                  <p className="mt-1 text-muted-foreground">{r.notes}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  {timeAgo(r.submittedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LineupCard({ side, team }: { side: string; team: TeamAdminView }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          {side} lineup
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-[color:var(--brand-crimson)]" />
          <span className="truncate">{team.teamName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {team.lineup.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            No players assigned.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {team.lineup.map((p) => {
              const isLead =
                p.role === "CAPTAIN" || p.role === "COACH" || p.role === "MANAGER";
              return (
                <li
                  key={p.userId}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-card"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-white">
                      {p.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((s) => s[0]?.toUpperCase() ?? "")
                        .join("") || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {p.name}
                      {isLead ? (
                        <Crown className="ml-1 inline h-3 w-3 text-[color:var(--brand-gold)]" />
                      ) : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
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
                    <span className="font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
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

function MatchMetaCard({ match }: { match: LeagueMatchDetail }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Details
        </p>
        <CardTitle className="text-base">Match info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[13px]">
        <Row label="Competition" value={match.competition} />
        <Row label="Game" value={match.game} />
        <Row label="Tier" value={match.tier.toLowerCase()} />
        <Row label="Format" value={`Best of ${match.bestOf}`} />
        {match.isForfeit ? (
          <>
            <Row
              label="Forfeit"
              value={
                <span className="inline-flex items-center gap-1 text-orange-500">
                  <Flag className="h-3 w-3" />
                  Recorded
                </span>
              }
            />
            {match.forfeitReason ? (
              <Row
                label="Reason"
                value={match.forfeitReason.replace(/_/g, " ").toLowerCase()}
              />
            ) : null}
            {match.forfeitingSide ? (
              <Row
                label="Forfeiter"
                value={
                  match.forfeitingSide === "HOME"
                    ? match.home.teamName
                    : match.away.teamName
                }
              />
            ) : null}
            <Row
              label="Reschedule tried"
              value={
                match.rescheduleAttempted === true
                  ? "Yes"
                  : match.rescheduleAttempted === false
                    ? "No"
                    : "—"
              }
            />
            {match.forfeitNotes ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-line text-[12px] text-muted-foreground">
                  {match.forfeitNotes}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MatchAuditCard({
  entries,
}: {
  entries: LeagueMatchDetail["matchAuditEntries"];
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          History
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-[color:var(--brand-purple)]" />
          Audit trail
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {entries.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            No admin actions on this match yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px]"
              >
                <span className="mt-0.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-purple)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {e.action.replace(/[._]/g, " ").toLowerCase()}
                    {e.actorName ? (
                      <>
                        {" · "}
                        <span className="text-muted-foreground">{e.actorName}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(e.when)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
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

function Monogram({ tone, text }: { tone: "crimson" | "zinc"; text: string }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold tracking-tight text-white",
        tone === "crimson"
          ? "from-[color:var(--brand-crimson)] to-rose-700"
          : "from-zinc-700 to-zinc-900",
      )}
    >
      {text}
    </div>
  );
}

function OutOfScopeCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed border-border/80 bg-card/40">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
          <Trophy className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Out of scope
        </p>
        <h3 className="max-w-md text-balance text-xl font-semibold tracking-tight">
          {title}
        </h3>
        <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Link
          href="/admin/matches"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all matches
        </Link>
      </CardContent>
    </Card>
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
