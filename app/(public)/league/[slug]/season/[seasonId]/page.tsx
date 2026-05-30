/**
 * Public season detail page.
 *
 * Anyone can view a single season's standings, schedule, and recent
 * results. All real Prisma data scoped to the slug + seasonId. Returns
 * 404 when either is wrong, or when the seasonId belongs to a different
 * league than the slug claims.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, Flag } from "lucide-react";

import { RielLockup, MatchStateMark } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { loadPublicSeason, type PublicSeasonDetail } from "@/lib/public/league";
import { cn } from "@/lib/utils";

export default async function PublicSeasonPage({
  params,
}: {
  params: Promise<{ slug: string; seasonId: string }>;
}) {
  const { slug, seasonId } = await params;
  const data = await loadPublicSeason(slug, seasonId);
  if (!data) notFound();

  const { league, season, competitions, recentResults, standings } = data;
  const matchesPlayed = competitions.reduce((s, c) => s + c.matchesPlayed, 0);
  const matchesTotal = competitions.reduce((s, c) => s + c.matchesTotal, 0);
  const progressPct = matchesTotal > 0 ? Math.round((matchesPlayed / matchesTotal) * 100) : 0;

  return (
    <div className="bg-system min-h-screen">
      <PublicHeader />

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Link
            href={`/league/${league.slug}`}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {league.name}
          </Link>
        </div>

        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              {season.startsAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" → "}
              {season.endsAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <h1 className="mt-1 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              {season.name}
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {competitions.length} competition{competitions.length === 1 ? "" : "s"} ·{" "}
              {matchesPlayed}/{matchesTotal} matches played
              {matchesTotal > 0 ? ` (${progressPct}%)` : ""}
            </p>
          </div>
          {competitions.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              In season
            </span>
          ) : null}
        </section>

        {competitions.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-card/40">
            <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
              No competitions in this season yet.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="standings">
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="standings">Standings</TabsTrigger>
              <TabsTrigger value="competitions">
                Competitions ({competitions.length})
              </TabsTrigger>
              <TabsTrigger value="results">
                Recent results ({recentResults.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="standings">
              <StandingsSection tables={standings} />
            </TabsContent>

            <TabsContent value="competitions">
              <CompetitionsSection competitions={competitions} />
            </TabsContent>

            <TabsContent value="results">
              <RecentResultsSection results={recentResults} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <PublicFooter slug={league.slug} leagueName={league.name} />
    </div>
  );
}

// --- Sections ----------------------------------------------------------

function StandingsSection({ tables }: { tables: PublicSeasonDetail["standings"] }) {
  if (tables.length === 0 || tables.every((t) => t.rows.length === 0)) {
    return (
      <Card className="border-dashed border-border/60 bg-card/40">
        <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
          Standings populate as teams play matches.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {tables.map((t) => {
        if (t.rows.length === 0) return null;
        return (
          <Card key={t.competitionId} className="border-border/60 bg-card/80">
            <CardHeader className="pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                {t.game}
              </p>
              <CardTitle className="text-base">{t.competitionName}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="py-2 text-left font-medium">Team</th>
                    <th className="px-3 py-2 text-right font-medium">W</th>
                    <th className="px-3 py-2 text-right font-medium">L</th>
                    <th className="px-3 py-2 text-right font-medium">PCT</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row) => {
                    const totalGames = row.wins + row.losses;
                    const winPct = totalGames > 0 ? row.wins / totalGames : 0;
                    return (
                      <tr key={row.rank} className="border-b border-border/30">
                        <td className="px-4 py-3 text-left">
                          {row.rank === 1 ? (
                            <Crown className="h-4 w-4 text-[color:var(--brand-gold)]" />
                          ) : (
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {row.rank}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-bold text-white">
                              {row.schoolShort
                                .replace(/[^A-Za-z]/g, "")
                                .slice(0, 3)
                                .toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold">{row.teamName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {row.schoolShort}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {row.wins}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
                          {row.losses}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {(winPct * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CompetitionsSection({
  competitions,
}: {
  competitions: PublicSeasonDetail["competitions"];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {competitions.map((c) => {
        const matchProgressPct =
          c.matchesTotal > 0 ? Math.round((c.matchesPlayed / c.matchesTotal) * 100) : 0;
        const isLive = c.state === "ACTIVE" && c.status === "IN_PROGRESS";
        return (
          <Card key={c.id} className="border-border/60 bg-card/80">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {c.tier}
                  </p>
                  <CardTitle className="mt-1 truncate text-[15px] font-semibold">
                    {c.name}
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">{c.game}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    isLive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {isLive ? "Live" : c.state.toLowerCase()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>Teams</span>
                <span className="font-mono font-bold tabular-nums">
                  {c.registeredTeams}
                </span>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                  <span>Match progress</span>
                  <span className="font-mono tabular-nums">
                    {c.matchesPlayed}/{c.matchesTotal} ({matchProgressPct}%)
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, matchProgressPct)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecentResultsSection({
  results,
}: {
  results: PublicSeasonDetail["recentResults"];
}) {
  if (results.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-card/40">
        <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
          No finished matches yet this season.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="px-2 pb-2">
        <ul className="divide-y divide-border/40">
          {results.map((r) => (
            <li key={r.matchId} className="flex items-center gap-3 px-3 py-2.5">
              <MatchStateMark state="completed" size={16} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">
                  {r.homeTeam} <span className="text-muted-foreground">vs</span> {r.awayTeam}
                  {r.isForfeit ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded-sm border border-orange-500/30 bg-orange-500/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-orange-500">
                      <Flag className="h-2.5 w-2.5" />
                      Forfeit
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.competition} ·{" "}
                  {r.finishedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              {r.homeScore !== null && r.awayScore !== null ? (
                <span className="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[12px] font-bold tabular-nums">
                  {r.homeScore}–{r.awayScore}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {r.game}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// --- Header / Footer ---------------------------------------------------

function PublicHeader() {
  return (
    <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="RIEL.GG home">
          <RielLockup height={28} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link
            href="/join"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
            )}
          >
            Apply your school
          </Link>
        </div>
      </div>
    </header>
  );
}

function PublicFooter({ slug, leagueName }: { slug: string; leagueName: string }) {
  return (
    <footer className="border-t border-border/60 bg-background/40 py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-[11px] text-muted-foreground">
        <p>Powered by RIEL.GG · {leagueName}</p>
        <div className="flex flex-wrap gap-4">
          <Link href={`/league/${slug}`} className="hover:text-foreground">
            League home
          </Link>
          <Link href={`/league/${slug}/results`} className="hover:text-foreground">
            Latest season
          </Link>
          <Link href="/join" className="hover:text-foreground">
            Apply
          </Link>
        </div>
      </div>
    </footer>
  );
}
