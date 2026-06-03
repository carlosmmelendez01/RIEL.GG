/**
 * League-admin competition detail.
 *
 * Scope-gated to the admin's league. Shows the competition header + the
 * single-elim playoff bracket (when the competition has a playoff stage).
 * Round-robin-only competitions render the header + a note pointing at the
 * scheduler / match list instead of a bracket.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarRange, ListChecks, Trophy, Wand2 } from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { Bracket } from "@/components/competition/bracket";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import { loadCompetitionBracket } from "@/lib/competition/bracket";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export default async function AdminCompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/admin/competitions/${id}`);

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="Competition" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <OutOfScope />
        </main>
      </>
    );
  }

  const competition = await prisma.competition.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      state: true,
      skillTier: true,
      gameTitle: { select: { name: true } },
      season: { select: { leagueId: true } },
      _count: { select: { rosters: true } },
    },
  });
  if (!competition || competition.season.leagueId !== ctx.league.id) {
    return (
      <>
        <AdminTopbar title="Competition not found" eyebrow={ctx.league.name} />
        <main className="flex-1 px-6 py-12 md:px-8">
          <OutOfScope />
        </main>
      </>
    );
  }

  const name = competition.name.replace(/^Spring 2026 — /, "");
  const bracket = await loadCompetitionBracket(ctx.league.id, id);

  return (
    <>
      <AdminTopbar
        title={name}
        eyebrow={`${ctx.league.name} · ${competition.gameTitle.name} · ${competition.skillTier.toLowerCase()}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/competitions"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            All competitions
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/scheduler"
              className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/8 px-3 py-1.5 text-[12px] font-semibold text-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold)]/15"
            >
              <Wand2 className="h-3 w-3" />
              Scheduler
            </Link>
            <Link
              href="/admin/matches"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-[12px] font-medium hover:bg-card"
            >
              <ListChecks className="h-3 w-3" />
              All matches
            </Link>
          </div>
        </div>

        {/* Header stats */}
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-white">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">
              {competition.gameTitle.name} · {competition.skillTier.toLowerCase()} ·{" "}
              {competition.state.toLowerCase()}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 font-mono text-[11px] tabular-nums">
            {competition._count.rosters} team{competition._count.rosters === 1 ? "" : "s"}
          </span>
        </section>

        {/* Bracket */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Playoff bracket
          </h2>
          {bracket ? (
            <Bracket data={bracket} />
          ) : (
            <Card className="border-dashed border-border/70 bg-card/40">
              <CardContent className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <CalendarRange className="h-6 w-6 text-muted-foreground" />
                <p className="text-[14px] font-semibold">No playoff stage</p>
                <p className="max-w-md text-[12px] leading-relaxed text-muted-foreground">
                  This competition is round-robin only — there&apos;s no single-elimination
                  stage to bracket. Competitions created with the &ldquo;Round Robin + Single
                  Elim&rdquo; format get a playoff bracket here.
                </p>
                <Link
                  href="/admin/matches"
                  className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--brand-crimson)] hover:underline"
                >
                  View match list
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}

function OutOfScope() {
  return (
    <Card className="border-dashed border-border/80 bg-card/40">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
          <Trophy className="h-5 w-5" />
        </div>
        <h3 className="max-w-md text-balance text-xl font-semibold tracking-tight">
          This competition isn&apos;t in your league.
        </h3>
        <Link
          href="/admin/competitions"
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[color:var(--brand-crimson-deep)]",
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to competitions
        </Link>
      </CardContent>
    </Card>
  );
}
