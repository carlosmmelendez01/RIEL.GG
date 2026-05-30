/**
 * League admin matches list.
 *
 * Cross-school by design (admins manage every match in their league), but
 * scoped to the admin's league. Replaces the previous mock-data page that
 * showed Carmel vs Fishers etc. to every league admin regardless of which
 * league they actually run.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchStateMark, matchStatusToState } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadLeagueMatches,
  requireLeagueAdmin,
  type LeagueMatchRow,
} from "@/lib/league-admin/dashboard";
import { cn } from "@/lib/utils";

export default async function AdminMatchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/matches");

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="All matches" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const matches = await loadLeagueMatches(ctx.league.id);

  if (matches.length === 0) {
    return (
      <>
        <AdminTopbar
          title="All matches"
          eyebrow={`${ctx.league.name} · ${ctx.admin.role.toLowerCase()}`}
        />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-matches" leagueName={ctx.league.name} />
        </main>
      </>
    );
  }

  // Bucket by status for the tabs
  const live = matches.filter(
    (m) => m.status === "IN_PROGRESS" || m.status === "CHECKING_IN",
  );
  const upcoming = matches.filter((m) => m.status === "SCHEDULED");
  const awaiting = matches.filter((m) => m.status === "AWAITING_CONFIRMATION");
  const disputed = matches.filter((m) => m.status === "DISPUTED");
  const finished = matches.filter(
    (m) => m.status === "FINISHED" || m.status === "FORFEITED",
  );

  return (
    <>
      <AdminTopbar
        title="All matches"
        eyebrow={`${ctx.league.name} · ${matches.length} match${matches.length === 1 ? "" : "es"} in window`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        {/* Status tabs */}
        <Tabs
          defaultValue={
            live.length > 0 ? "live" : disputed.length > 0 ? "disputed" : "upcoming"
          }
        >
          <TabsList className="mb-4 flex flex-wrap">
            <TabsTrigger value="live">
              Live
              {live.length > 0 ? <Badge tone="emerald">{live.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming
              {upcoming.length > 0 ? <Badge>{upcoming.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="awaiting">
              Awaiting
              {awaiting.length > 0 ? <Badge tone="gold">{awaiting.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="disputed">
              Disputed
              {disputed.length > 0 ? <Badge tone="crimson">{disputed.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="finished">
              Finished
              {finished.length > 0 ? <Badge tone="muted">{finished.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="all">All ({matches.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <MatchList matches={live} emptyMessage="No matches live right now." />
          </TabsContent>
          <TabsContent value="upcoming">
            <MatchList matches={upcoming} emptyMessage="No scheduled matches in the window." />
          </TabsContent>
          <TabsContent value="awaiting">
            <MatchList matches={awaiting} emptyMessage="No matches awaiting confirmation." />
          </TabsContent>
          <TabsContent value="disputed">
            <MatchList matches={disputed} emptyMessage="No open disputes — clean week." />
          </TabsContent>
          <TabsContent value="finished">
            <MatchList matches={finished} emptyMessage="No finished matches yet." />
          </TabsContent>
          <TabsContent value="all">
            <MatchList matches={matches} emptyMessage="No matches found." />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

// --- Subcomponents -----------------------------------------------------

function MatchList({
  matches,
  emptyMessage,
}: {
  matches: LeagueMatchRow[];
  emptyMessage: string;
}) {
  if (matches.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-card/40">
        <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  // Group by day for readability
  const groups = new Map<string, LeagueMatchRow[]>();
  for (const m of matches) {
    const key = m.scheduledAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([day, items]) => (
        <Card key={day} className="border-border/60 bg-card/80">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              {day}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {items.length} match{items.length === 1 ? "" : "es"}
            </p>
          </div>
          <CardContent className="px-2 pb-2">
            <ul className="divide-y divide-border/40">
              {items.map((m) => (
                <MatchListRow key={m.matchId} match={m} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MatchListRow({ match }: { match: LeagueMatchRow }) {
  const isFinished = match.status === "FINISHED" || match.status === "FORFEITED";
  const isDisputed = match.status === "DISPUTED";
  return (
    <li>
      <Link
        href={`/admin/matches/${match.matchId}`}
        className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-card"
      >
        <MatchStateMark state={matchStatusToState(match.status)} size={20} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">
            {match.homeTeam}{" "}
            <span className="text-muted-foreground">vs</span>{" "}
            {match.awayTeam}
            {match.isForfeit ? (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-sm border border-orange-500/40 bg-orange-500/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-orange-500">
                Forfeit
              </span>
            ) : null}
            {isDisputed ? (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-sm border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-[color:var(--brand-crimson)]">
                <CircleAlert className="h-2.5 w-2.5" />
                Disputed
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {match.scheduledAt.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {match.competition}
          </p>
        </div>

        {isFinished && match.homeScore !== null && match.awayScore !== null ? (
          <span className="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[12px] font-bold tabular-nums">
            {match.homeScore}–{match.awayScore}
          </span>
        ) : null}

        <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {match.game}
        </span>

        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </Link>
    </li>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "crimson" | "emerald" | "gold" | "muted";
}) {
  return (
    <span
      className={cn(
        "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        tone === "crimson" && "bg-[color:var(--brand-crimson)] text-white",
        tone === "emerald" && "bg-emerald-500 text-black",
        tone === "gold" && "bg-[color:var(--brand-gold)] text-black",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "default" && "bg-card border border-border/60 text-foreground",
      )}
    >
      {children}
    </span>
  );
}
