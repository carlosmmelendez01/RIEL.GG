/**
 * Player profile — MVP.
 *
 * A simple, read-only player view: identity, win/loss record, teams, and the
 * player's upcoming + recent matches. All real Prisma data via
 * `loadPlayerProfile`.
 *
 * The previous social-first profile (feed, posts, goals, comments, match-day
 * chat) is out of MVP scope. Those components + loaders remain in the repo
 * (components/player/*, lib/player/social-*, match-day) for a later release —
 * see git history for the original page.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Crown, Trophy, UserRound, Users } from "lucide-react";

import { RielIcon } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadPlayerProfile, type PlayerMatchRow } from "@/lib/player/data";
import { cn } from "@/lib/utils";

export default async function PlayerHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const profile = await loadPlayerProfile(user.id);
  if (!profile) redirect("/login");

  if (profile.teams.length === 0) {
    return <NoTeamsState fullName={profile.user.fullName} />;
  }

  const { user: me, stats, teams, upcoming, recentResults } = profile;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <Link href="/me" aria-label="RIEL.GG" className="flex items-center gap-2">
          <RielIcon size={30} />
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            My profile
          </span>
        </Link>
        <ThemeToggle variant="subtle" />
      </header>

      <main className="flex-1 space-y-6 px-6 py-6">
        {/* Identity + record */}
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-5">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-base font-semibold text-white">
              {me.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{me.fullName}</h1>
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">
              {me.schoolName ?? "No school"}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Record" value={`${stats.wins}–${stats.losses}`} />
          <StatCard label="Win rate" value={`${Math.round(stats.winRate)}%`} />
          <StatCard label="Played" value={String(stats.matchesPlayed)} />
          <StatCard
            label="Streak"
            value={
              stats.currentStreak.kind === "NONE"
                ? "—"
                : `${stats.currentStreak.length}${stats.currentStreak.kind === "WIN" ? "W" : "L"}`
            }
            tone={stats.currentStreak.kind === "WIN" ? "emerald" : stats.currentStreak.kind === "LOSS" ? "crimson" : "muted"}
          />
        </section>

        {/* Teams */}
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-[color:var(--brand-crimson)]" />
              Your teams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teams.map((t) => {
              const lead = t.role === "CAPTAIN" || t.role === "COACH" || t.role === "MANAGER";
              return (
                <div
                  key={t.teamId}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[11px] font-bold text-white">
                    {t.teamName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {t.teamName}
                      {lead ? <Crown className="ml-1 inline h-3 w-3 text-[color:var(--brand-gold)]" /> : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.game} · {t.competitionName}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {t.role.toLowerCase()}
                    {t.jerseyNumber !== null ? ` · #${t.jerseyNumber}` : ""}
                    {!t.isStarter ? " · sub" : ""}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-[color:var(--brand-purple)]" />
              Upcoming matches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-foreground">
                No upcoming matches scheduled.
              </p>
            ) : (
              upcoming.map((m) => <MatchRow key={m.matchId} m={m} upcoming />)
            )}
          </CardContent>
        </Card>

        {/* Recent results */}
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-[color:var(--brand-gold)]" />
              Recent results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentResults.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-foreground">
                No completed matches yet.
              </p>
            ) : (
              recentResults.map((m) => <MatchRow key={m.matchId} m={m} />)
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// --- Subcomponents ------------------------------------------------------

function StatCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "emerald" | "crimson";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-center">
      <p
        className={cn(
          "font-mono text-xl font-bold tabular-nums",
          tone === "emerald" && "text-emerald-500",
          tone === "crimson" && "text-[color:var(--brand-crimson)]",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function MatchRow({ m, upcoming }: { m: PlayerMatchRow; upcoming?: boolean }) {
  const won = m.result === "WIN" || m.result === "FORFEIT_BY_THEM";
  const lost = m.result === "LOSS" || m.result === "FORFEIT_BY_US";
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {m.ownTeamName} <span className="text-muted-foreground">vs</span> {m.opponentTeamName}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {m.game} ·{" "}
          {m.scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {m.isForfeit ? " · forfeit" : ""}
        </p>
      </div>
      {upcoming ? (
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {m.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </span>
      ) : m.ourScore !== null && m.theirScore !== null ? (
        <span
          className={cn(
            "font-mono text-[13px] font-bold tabular-nums",
            won && "text-emerald-500",
            lost && "text-[color:var(--brand-crimson)]",
          )}
        >
          {m.ourScore}–{m.theirScore}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground">{m.result.toLowerCase()}</span>
      )}
    </div>
  );
}

function NoTeamsState({ fullName }: { fullName: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]">
        <UserRound className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight">
        Welcome to RIEL.GG, {fullName.split(" ")[0]}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;re not on a team roster yet. Once your coach adds you to a roster, your matches and
        stats will live here.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Use a different account
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
