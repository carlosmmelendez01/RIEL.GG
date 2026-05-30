/**
 * Public league profile.
 *
 * Anyone can view this — coaches, parents, prospective schools, recruiters.
 * All real Prisma data scoped to the league slug. The previous mock view
 * showed identical hardcoded data for every league.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Calendar,
  Trophy,
  Users,
} from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { loadPublicLeague, type PublicLeagueSchool, type PublicLeagueSeason } from "@/lib/public/league";
import { cn } from "@/lib/utils";

export default async function PublicLeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicLeague(slug);
  if (!data) notFound();

  const { league, seasons, schools } = data;
  const accentColor = league.primaryColor ?? "var(--brand-crimson)";

  return (
    <div className="bg-system min-h-screen">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="absolute inset-0 opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${accentColor} 0%, transparent 60%)`,
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-5">
            <div
              aria-hidden
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold tracking-tight text-white shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${accentColor} 0%, color-mix(in oklab, ${accentColor}, black 30%) 100%)`,
              }}
            >
              {monogramFor(league.name)}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {league.classification}
              </p>
              <h1 className="mt-1 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
                {league.name}
              </h1>
              {league.description ? (
                <p className="mt-2 max-w-xl text-balance text-[14px] text-muted-foreground">
                  {league.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/join"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
              )}
            >
              Apply your school
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href={`/league/${league.slug}/results`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Latest results
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat icon={Building2} label="Schools" value={league.schoolCount} />
          <Stat icon={Trophy} label="Teams" value={league.teamCount} />
          <Stat icon={Users} label="Players" value={league.playerCount} />
          <Stat icon={Calendar} label="Matches played" value={league.matchesPlayed} />
        </section>

        {/* Seasons */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
                Seasons
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {seasons.length} season{seasons.length === 1 ? "" : "s"} on record
              </h2>
            </div>
          </div>

          {seasons.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/40">
              <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
                No seasons yet. Check back when registration opens.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {seasons.map((s) => (
                <SeasonCard key={s.id} season={s} leagueSlug={league.slug} />
              ))}
            </div>
          )}
        </section>

        {/* Schools */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-purple)]">
                Member schools
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {schools.length} school{schools.length === 1 ? "" : "s"} competing
              </h2>
            </div>
          </div>

          {schools.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/40">
              <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
                No member schools yet. Be the first — apply your school below.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {schools.slice(0, 12).map((s) => (
                <SchoolMini key={s.id} school={s} />
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <section>
          <Card className="border-[color:var(--brand-crimson)]/25 bg-card/60">
            <CardContent className="grid gap-4 px-6 py-10 md:grid-cols-[1fr_auto] md:items-center md:px-10">
              <div>
                <h3 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                  Want your school in {league.name}?
                </h3>
                <p className="mt-2 max-w-xl text-balance text-[13px] text-muted-foreground">
                  Applications are open year-round. Approval typically takes one business
                  day once the league office verifies your NCES ID.
                </p>
              </div>
              <Link
                href="/join"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
                )}
              >
                Apply your school
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

// --- Subcomponents -----------------------------------------------------

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

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          <Icon className="h-4 w-4 text-[color:var(--brand-crimson)]" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SeasonCard({
  season,
  leagueSlug,
}: {
  season: PublicLeagueSeason;
  leagueSlug: string;
}) {
  const progressPct =
    season.matchesTotal > 0 ? Math.round((season.matchesPlayed / season.matchesTotal) * 100) : 0;
  return (
    <Link href={`/league/${leagueSlug}/season/${season.id}`} className="group block">
      <Card className="hover-edge-crimson border-border/60 bg-card/80 transition-colors hover:bg-card">
        <CardHeader className="pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {season.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" → "}
            {season.endsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          <CardTitle className="text-xl font-semibold">{season.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <Mini label="Competitions" value={season.competitionCount} />
            <Mini label="Teams" value={season.teamCount} />
          </div>
          {season.matchesTotal > 0 ? (
            <div>
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>Season progress</span>
                <span className="font-mono tabular-nums">
                  {season.matchesPlayed}/{season.matchesTotal} ({progressPct}%)
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-[color:var(--brand-crimson)] transition-all"
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No matches scheduled yet.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-[18px] font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function SchoolMini({ school }: { school: PublicLeagueSchool }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-[11px] font-bold text-white">
        {(school.shortName ?? school.name)
          .replace(/[^A-Za-z]/g, "")
          .slice(0, 3)
          .toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {school.shortName ?? school.name}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {school.city ? `${school.city}, ${school.state ?? ""}` : school.name}
        </p>
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {school.teamCount} team{school.teamCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function monogramFor(name: string): string {
  if (/^[A-Z]{2,5}\b/.test(name)) {
    return name.match(/^[A-Z]+/)![0].slice(0, 4);
  }
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}
