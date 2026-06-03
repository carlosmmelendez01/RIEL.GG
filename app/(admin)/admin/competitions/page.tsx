/**
 * League competitions list.
 *
 * Pulls the admin's league's competitions from `loadLeagueAdminDashboard`
 * and groups by state. Replaces the previous mock view that showed the
 * same 5 demo competitions to every league admin.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus, Wand2 } from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { PendingRostersCard } from "@/components/admin/pending-rosters-card";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadLeagueAdminDashboard,
  loadPendingRosters,
  requireLeagueAdmin,
  type LeagueCompetition,
} from "@/lib/league-admin/dashboard";
import { cn } from "@/lib/utils";

export default async function CompetitionsAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/competitions");

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="Competitions" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const [data, pendingRosters] = await Promise.all([
    loadLeagueAdminDashboard(user.id),
    loadPendingRosters(ctx.league.id),
  ]);
  const competitions = data?.competitions ?? [];

  const active = competitions.filter((c) => c.state === "ACTIVE");
  const draft = competitions.filter((c) => c.state === "DRAFT");
  const complete = competitions.filter((c) => c.state === "COMPLETE");

  return (
    <>
      <AdminTopbar
        title="Competitions"
        eyebrow={`${ctx.league.name} · ${active.length} active · ${draft.length} draft · ${complete.length} archived${pendingRosters.length > 0 ? ` · ${pendingRosters.length} roster${pendingRosters.length === 1 ? "" : "s"} pending` : ""}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <PendingRostersCard rosters={pendingRosters} />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/scheduler"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/8 text-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold)]/15",
              )}
            >
              <Wand2 className="mr-1.5 h-3 w-3" />
              Scheduler
            </Link>
            <Link
              href="/admin/competitions/new"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
              )}
            >
              <Plus className="mr-1.5 h-3 w-3" />
              New competition
            </Link>
          </div>
        </div>

        {competitions.length === 0 ? (
          <LeagueAdminEmptyState kind="no-competitions" leagueName={ctx.league.name} />
        ) : (
          <Tabs defaultValue={active.length > 0 ? "active" : draft.length > 0 ? "draft" : "complete"}>
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="draft">Draft ({draft.length})</TabsTrigger>
              <TabsTrigger value="complete">Archived ({complete.length})</TabsTrigger>
              <TabsTrigger value="all">All ({competitions.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <CompetitionGrid items={active} emptyMessage="No active competitions right now." />
            </TabsContent>
            <TabsContent value="draft">
              <CompetitionGrid items={draft} emptyMessage="No drafts. Start one with “New competition”." />
            </TabsContent>
            <TabsContent value="complete">
              <CompetitionGrid items={complete} emptyMessage="No archived competitions yet." />
            </TabsContent>
            <TabsContent value="all">
              <CompetitionGrid items={competitions} emptyMessage="No competitions yet." />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </>
  );
}

// --- Subcomponents ----------------------------------------------------

function CompetitionGrid({
  items,
  emptyMessage,
}: {
  items: LeagueCompetition[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-card/40">
        <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <CompetitionCard key={c.id} comp={c} />
      ))}
    </div>
  );
}

function CompetitionCard({ comp }: { comp: LeagueCompetition }) {
  const fillPct =
    comp.expectedTeams > 0 ? Math.round((comp.registeredTeams / comp.expectedTeams) * 100) : 0;
  const matchPct =
    comp.matchesTotal > 0 ? Math.round((comp.matchesPlayed / comp.matchesTotal) * 100) : 0;
  const isLive = comp.state === "ACTIVE" && comp.status === "IN_PROGRESS";

  return (
    <Link href={`/admin/competitions/${comp.id}`} className="block">
      <Card
        className={cn(
          "group hover-edge-crimson border-border/60 bg-card/80 transition-colors hover:bg-card",
          isLive && "edge-crimson",
        )}
      >
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {comp.tier}
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold tracking-tight">
                {comp.name}
              </p>
              <p className="text-[11px] text-muted-foreground">{comp.game}</p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                isLive && "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
                comp.state === "DRAFT" &&
                  "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
                comp.state === "COMPLETE" && "border-border bg-muted text-muted-foreground",
                !isLive && comp.state === "ACTIVE" &&
                  "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
              )}
            >
              {isLive ? "Live" : comp.state.toLowerCase()}
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-muted-foreground">Slots filled</span>
              <span className="font-mono font-bold tabular-nums">
                {comp.registeredTeams}/{comp.expectedTeams}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[color:var(--brand-crimson)] transition-all"
                style={{ width: `${Math.min(100, fillPct)}%` }}
              />
            </div>
          </div>

          {comp.matchesTotal > 0 ? (
            <div>
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>Match progress</span>
                <span className="font-mono tabular-nums">
                  {comp.matchesPlayed}/{comp.matchesTotal} ({matchPct}%)
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, matchPct)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No matches scheduled yet.</p>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[11px]">
            <span className="text-muted-foreground">View bracket &amp; details</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
