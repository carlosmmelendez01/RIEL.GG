/**
 * Platform → Leagues directory.
 *
 * Lists the REAL leagues in the database (previously this rendered mock data,
 * which made freshly-provisioned leagues appear to "not save"). Each row shows
 * the league, its owner (from the OWNER LeagueAdminship — "Invite pending" when
 * nobody has claimed yet), school + season counts, and a link into the league.
 */

import Link from "next/link";
import { ArrowRight, Mail, Plus, Search } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

type LeagueRowData = {
  id: string;
  name: string;
  slug: string;
  classification: string;
  primaryColor: string | null;
  createdAt: Date;
  schoolCount: number;
  seasonCount: number;
  owner: { name: string; email: string } | null;
};

async function loadLeagues(): Promise<LeagueRowData[]> {
  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      classification: true,
      primaryColor: true,
      createdAt: true,
      _count: { select: { memberships: true, seasons: true } },
      adminships: {
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { fullName: true, email: true } } },
      },
    },
  });

  return leagues.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    classification: l.classification,
    primaryColor: l.primaryColor,
    createdAt: l.createdAt,
    schoolCount: l._count.memberships,
    seasonCount: l._count.seasons,
    owner: l.adminships[0]
      ? { name: l.adminships[0].user.fullName, email: l.adminships[0].user.email }
      : null,
  }));
}

export default async function PlatformLeaguesPage() {
  const leagues = await loadLeagues();
  const claimed = leagues.filter((l) => l.owner !== null).length;
  const pending = leagues.length - claimed;

  return (
    <>
      <PlatformTopbar
        title="Leagues"
        eyebrow={`${leagues.length} total · ${claimed} claimed · ${pending} invite pending`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leagues, owners, regions…"
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Link
            href="/platform/leagues/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
            )}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Create League
          </Link>
        </div>

        <LeagueTable items={leagues} />
      </main>
    </>
  );
}

function LeagueTable({ items }: { items: LeagueRowData[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No leagues yet. Create one to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-3 pl-4 text-left font-medium">League</th>
                <th className="py-3 text-left font-medium">Owner</th>
                <th className="py-3 text-left font-medium">Class</th>
                <th className="py-3 text-right font-medium">Schools</th>
                <th className="py-3 text-right font-medium">Seasons</th>
                <th className="py-3 text-right font-medium">Created</th>
                <th className="py-3 pr-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <LeagueRow key={l.id} league={l} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z0-9]/.test(w))
      .map((w) => w[0])
      .join("")
      .slice(0, 4)
      .toUpperCase() || "LG"
  );
}

function LeagueRow({ league }: { league: LeagueRowData }) {
  const color = league.primaryColor ?? "#A31F34";
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-card">
      <td className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-tight text-white shadow-inner"
            style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)` }}
          >
            {initials(league.name)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{league.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">riel.gg/{league.slug}</p>
          </div>
        </div>
      </td>
      <td className="py-3">
        {league.owner ? (
          <>
            <p className="text-[13px]">{league.owner.name}</p>
            <a
              href={`mailto:${league.owner.email}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3 w-3" />
              {league.owner.email}
            </a>
          </>
        ) : (
          <span className="rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
            Invite pending
          </span>
        )}
      </td>
      <td className="py-3 text-[12px] text-muted-foreground">{league.classification}</td>
      <td className="py-3 text-right font-mono tabular-nums">{league.schoolCount}</td>
      <td className="py-3 text-right font-mono tabular-nums">{league.seasonCount}</td>
      <td className="py-3 text-right text-[12px] text-muted-foreground">
        {league.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </td>
      <td className="py-3 pr-4 text-right">
        <Link
          href={`/league/${league.slug}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Open
          <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}
