/**
 * Real-data featured leagues. Pulls every League from the DB and joins it to
 * brief-supplied metadata (region, status, monogram, accent color) so the
 * public homepage shows authentic counts with proper league branding.
 */

import Link from "next/link";
import { ArrowRight, Building2, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

// Brief-supplied metadata — region + status + monogram + accent color.
// Keyed by league `slug` (which IS on the schema). When League.region and
// League.lifecycleStatus land on the schema, this map evaporates.
type LeagueMeta = {
  region: string;
  status: "ACTIVE" | "TRIAL" | "ONBOARDING";
  monogram: string;
  /** Tailwind classes for the monogram badge background gradient + text */
  badgeClass: string;
};

const LEAGUE_META: Record<string, LeagueMeta> = {
  riel: {
    region: "National",
    status: "ACTIVE",
    monogram: "RIEL",
    badgeClass: "bg-gradient-to-br from-zinc-900 to-zinc-800 text-[color:var(--brand-crimson)]",
  },
  hea: {
    region: "Indiana",
    status: "ACTIVE",
    monogram: "HEA",
    badgeClass:
      "bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-white",
  },
  "michigan-collegiate": {
    region: "Michigan",
    status: "TRIAL",
    monogram: "MCE",
    badgeClass: "bg-gradient-to-br from-amber-500 to-orange-700 text-white",
  },
  "esports-ohio": {
    region: "Ohio",
    status: "ACTIVE",
    monogram: "EO",
    badgeClass: "bg-gradient-to-br from-red-600 to-amber-700 text-white",
  },
  prairie: {
    region: "Midwest",
    status: "ONBOARDING",
    monogram: "PCE",
    badgeClass:
      "bg-gradient-to-br from-[color:var(--brand-purple)] to-violet-800 text-white",
  },
};

const STATUS_CLASS: Record<LeagueMeta["status"], string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  TRIAL:
    "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  ONBOARDING:
    "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
};

export async function FeaturedLeagues() {
  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { memberships: true } },
      memberships: {
        select: {
          school: {
            select: {
              teams: {
                select: {
                  rosters: {
                    select: { _count: { select: { members: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const rows = leagues.map((l) => {
    const schools = l._count.memberships;
    // Sum unique players across all schools in this league via roster memberships
    const players = l.memberships.reduce((sum, m) => {
      const teamSum = m.school.teams.reduce(
        (t, team) => t + team.rosters.reduce((r, ros) => r + ros._count.members, 0),
        0,
      );
      return sum + teamSum;
    }, 0);
    const meta = LEAGUE_META[l.slug] ?? {
      region: "—",
      status: "ACTIVE" as const,
      monogram: l.name.split(/\s+/).slice(0, 3).map((w) => w[0]?.toUpperCase()).join(""),
      badgeClass:
        "bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-white",
    };
    return {
      slug: l.slug,
      name: l.name,
      description: l.description,
      ...meta,
      schools,
      players,
    };
  });

  return (
    <section className="relative border-t border-border/60 py-24" id="leagues">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              Featured leagues
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Find a league. Or run one.
            </h2>
            <div
              aria-hidden
              className="mt-3 h-0.5 w-12 rounded-full bg-[color:var(--brand-crimson)]"
            />
          </div>
          <Link
            href="/leagues"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all leagues
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {rows.map((r) => (
            <Link
              key={r.slug}
              href={`/league/${r.slug}`}
              className="group block focus:outline-none"
            >
              <Card className="hover-edge-crimson relative h-full overflow-hidden border-border/60 bg-card/80 transition-colors hover:bg-card">
                {/* Top accent bar */}
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 top-0 h-px",
                    r.status === "ACTIVE" &&
                      "bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent",
                    r.status === "TRIAL" &&
                      "bg-gradient-to-r from-transparent via-[color:var(--brand-gold)]/60 to-transparent",
                    r.status === "ONBOARDING" &&
                      "bg-gradient-to-r from-transparent via-[color:var(--brand-purple)]/60 to-transparent",
                  )}
                />
                <CardContent className="flex h-full flex-col p-5">
                  {/* Region + Status row */}
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {r.region}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        STATUS_CLASS[r.status],
                      )}
                    >
                      {r.status === "ACTIVE" && (
                        <span className="relative flex h-1 w-1">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                          <span className="relative inline-flex h-1 w-1 rounded-full bg-current" />
                        </span>
                      )}
                      {r.status}
                    </span>
                  </div>

                  {/* Monogram badge + name */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[12px] font-bold tracking-tight shadow-md",
                        r.badgeClass,
                      )}
                    >
                      {r.monogram}
                    </div>
                    <h3 className="min-w-0 text-[15px] font-semibold leading-tight tracking-tight">
                      {r.name}
                    </h3>
                  </div>

                  {/* Description */}
                  {r.description ? (
                    <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                      {r.description}
                    </p>
                  ) : null}

                  {/* Stats footer */}
                  <div className="mt-4 grid flex-1 grid-cols-2 items-end gap-3 border-t border-border/60 pt-3">
                    <Stat icon={Building2} label="Schools" value={String(r.schools)} />
                    <Stat icon={Users} label="Players" value={String(r.players)} />
                  </div>

                  <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[color:var(--brand-crimson)] transition-colors group-hover:text-[color:var(--brand-crimson-deep)]">
                    View League
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
