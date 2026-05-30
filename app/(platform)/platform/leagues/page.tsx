import Link from "next/link";
import { ArrowRight, Mail, Plus, Search } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { PLATFORM_LEAGUES, type PlatformLeague } from "@/lib/mock/platform";
import { cn } from "@/lib/utils";

export default function PlatformLeaguesPage() {
  const all = PLATFORM_LEAGUES;
  const active = all.filter((l) => l.status === "ACTIVE");
  const trial = all.filter((l) => l.status === "TRIAL");
  const onboarding = all.filter((l) => l.status === "ONBOARDING");

  return (
    <>
      <PlatformTopbar
        title="Leagues"
        eyebrow={`${active.length} active · ${trial.length} trial · ${onboarding.length} onboarding`}
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

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="trial">Trial ({trial.length})</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding ({onboarding.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <LeagueTable items={all} />
          </TabsContent>
          <TabsContent value="active" className="mt-4">
            <LeagueTable items={active} />
          </TabsContent>
          <TabsContent value="trial" className="mt-4">
            <LeagueTable items={trial} />
          </TabsContent>
          <TabsContent value="onboarding" className="mt-4">
            <LeagueTable items={onboarding} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function LeagueTable({ items }: { items: PlatformLeague[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No leagues here.
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
                <th className="py-3 text-left font-medium">Status</th>
                <th className="py-3 text-right font-medium">Schools</th>
                <th className="py-3 text-right font-medium">Players</th>
                <th className="py-3 text-right font-medium">Wk matches</th>
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

const STATUS_TONE = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  TRIAL: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  ONBOARDING: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  PAUSED: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

function LeagueRow({ league }: { league: PlatformLeague }) {
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-card">
      <td className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-tight text-white shadow-inner"
            style={{
              background: `linear-gradient(135deg, ${league.primaryColor} 0%, ${league.secondaryColor ?? league.primaryColor} 100%)`,
            }}
          >
            {league.shortName.slice(0, 4)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{league.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">riel.gg/{league.slug}</p>
          </div>
        </div>
      </td>
      <td className="py-3">
        <p className="text-[13px]">{league.ownerName}</p>
        <a
          href={`mailto:${league.ownerEmail}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Mail className="h-3 w-3" />
          {league.ownerEmail}
        </a>
      </td>
      <td className="py-3">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            STATUS_TONE[league.status],
          )}
        >
          {league.status}
        </span>
        {league.trialEndsIn ? (
          <p className="mt-0.5 text-[11px] text-[color:var(--brand-purple)]">Ends in {league.trialEndsIn}</p>
        ) : null}
      </td>
      <td className="py-3 text-right font-mono tabular-nums">{league.schoolCount}</td>
      <td className="py-3 text-right font-mono tabular-nums">{league.activePlayers}</td>
      <td className="py-3 text-right font-mono tabular-nums">{league.matchesThisWeek}</td>
      <td className="py-3 text-right text-[12px] text-muted-foreground">{league.createdAgo} ago</td>
      <td className="py-3 pr-4 text-right">
        <button className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}>
          Open
          <ArrowRight className="ml-1 h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}
