import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Globe2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ADMIN_USER } from "@/lib/mock/admin";
import {
  PLATFORM_ACTIVITY,
  PLATFORM_LEAGUES,
  PLATFORM_TOTALS,
  type PlatformActivityItem,
  type PlatformLeague,
} from "@/lib/mock/platform";
import { cn } from "@/lib/utils";

export default function PlatformOverviewPage() {
  const trialing = PLATFORM_LEAGUES.filter((l) => l.status === "TRIAL");
  const onboarding = PLATFORM_LEAGUES.filter((l) => l.status === "ONBOARDING");

  return (
    <>
      <PlatformTopbar
        title="Platform overview"
        eyebrow={`RIEL.GG · ${PLATFORM_TOTALS.totalLeagues} leagues across ${PLATFORM_TOTALS.totalSchools} schools`}
      />

      <main className="flex-1 space-y-8 px-6 py-6 md:px-8">
        {/* Greeting + headline */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Welcome back, <span className="text-foreground">{ADMIN_USER.name}</span>.
            </p>
            <h2 className="mt-1 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              <span className="text-[color:var(--brand-purple)]">{trialing.length}</span> trial and{" "}
              <span className="text-[color:var(--brand-gold)]">{onboarding.length}</span> onboarding leagues to
              watch.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/platform/leagues"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Trophy className="mr-1.5 h-3.5 w-3.5" />
              All leagues
            </Link>
            <Link
              href="/platform/leagues/new"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
              )}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create League
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlatformStatCard
            label="Active leagues"
            value={String(PLATFORM_TOTALS.activeLeagues)}
            sub={`${PLATFORM_TOTALS.trialLeagues} trial · ${PLATFORM_TOTALS.onboardingLeagues} onboarding`}
            icon={Trophy}
            tone="crimson"
          />
          <PlatformStatCard
            label="Schools across platform"
            value={String(PLATFORM_TOTALS.totalSchools)}
            sub={`${PLATFORM_TOTALS.totalCoaches} coaches · ${PLATFORM_TOTALS.totalPlayers} players`}
            icon={Building2}
          />
          <PlatformStatCard
            label="Matches this week"
            value={String(PLATFORM_TOTALS.matchesThisWeek)}
            sub="Across every active league"
            icon={Zap}
            tone="gold"
          />
          <PlatformStatCard
            label="MRR estimate"
            value="$8,420"
            sub="3 leagues on Tier 2 · 1 trial"
            icon={Banknote}
            tone="purple"
          />
        </section>

        {/* Trial + onboarding watchlist */}
        {(trialing.length > 0 || onboarding.length > 0) && (
          <section className="grid gap-4 lg:grid-cols-2">
            {trialing.length > 0 ? (
              <Card className="border-[color:var(--brand-purple)]/30 bg-card/80">
                <CardHeader className="pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Trial watchlist
                  </p>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-[color:var(--brand-purple)]" />
                    {trialing.length} league{trialing.length === 1 ? "" : "s"} on trial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trialing.map((l) => (
                    <TrialRow key={l.id} league={l} />
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {onboarding.length > 0 ? (
              <Card className="border-[color:var(--brand-gold)]/30 bg-card/80">
                <CardHeader className="pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Onboarding queue
                  </p>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-[color:var(--brand-gold)]" />
                    {onboarding.length} new league{onboarding.length === 1 ? "" : "s"} setting up
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {onboarding.map((l) => (
                    <OnboardingRow key={l.id} league={l} />
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </section>
        )}

        {/* Leagues grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              All leagues
            </h3>
            <Link
              href="/platform/leagues"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Open directory
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PLATFORM_LEAGUES.map((l) => (
              <LeagueCard key={l.id} league={l} />
            ))}
          </div>
        </section>

        {/* Activity */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PlatformActivityCard />
          </div>
          <div>
            <PlatformQuickActionsCard />
          </div>
        </section>
      </main>
    </>
  );
}

// --- Subcomponents -------------------------------------------------------

function PlatformStatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  tone?: "default" | "crimson" | "gold" | "purple";
}) {
  return (
    <Card className="hover-edge-crimson border-border/60 bg-card/80 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border",
            tone === "crimson" && "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
            tone === "gold" && "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
            tone === "purple" && "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
            tone === "default" && "border-border bg-background text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </div>
    </Card>
  );
}

function TrialRow({ league }: { league: PlatformLeague }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
      <LeagueMark league={league} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{league.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {league.ownerName} · {league.schoolCount} schools · {league.region}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trial ends</p>
          <p className="text-[12px] font-semibold text-[color:var(--brand-purple)]">
            in {league.trialEndsIn}
          </p>
        </div>
        <button className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>Convert</button>
      </div>
    </div>
  );
}

function OnboardingRow({ league }: { league: PlatformLeague }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
      <LeagueMark league={league} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{league.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {league.ownerName} · created {league.createdAgo} ago · {league.region}
        </p>
      </div>
      <button className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>Help onboard</button>
    </div>
  );
}

function LeagueCard({ league }: { league: PlatformLeague }) {
  const status = LEAGUE_STATUS_TONE[league.status];
  return (
    <Card className="group hover-edge-crimson border-border/60 bg-card/80 transition-colors hover:bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <LeagueMark league={league} size={40} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {league.region}
              </p>
              <CardTitle className="mt-0.5 text-[15px] font-semibold tracking-tight">
                {league.name}
              </CardTitle>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              status.cls,
            )}
          >
            {status.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Schools" value={String(league.schoolCount)} />
          <Stat label="Players" value={String(league.activePlayers)} />
          <Stat label="This wk" value={String(league.matchesThisWeek)} />
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span className="truncate">{league.ownerName}</span>
          <span className="font-mono tabular-nums">riel.gg/{league.slug}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-[15px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function LeagueMark({ league, size = 32 }: { league: PlatformLeague; size?: number }) {
  return (
    <div
      role="img"
      aria-label={league.shortName}
      className="flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-tight text-white shadow-inner"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${league.primaryColor} 0%, ${league.secondaryColor ?? league.primaryColor} 100%)`,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {league.shortName.slice(0, 4)}
    </div>
  );
}

const LEAGUE_STATUS_TONE: Record<PlatformLeague["status"], { label: string; cls: string }> = {
  ACTIVE: {
    label: "Active",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  TRIAL: {
    label: "Trial",
    cls: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  },
  ONBOARDING: {
    label: "Onboarding",
    cls: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  },
  PAUSED: {
    label: "Paused",
    cls: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  },
};

function PlatformActivityCard() {
  const ICON: Record<PlatformActivityItem["kind"], { icon: LucideIcon; tone: string }> = {
    league_created: {
      icon: Sparkles,
      tone: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
    },
    league_activated: {
      icon: CheckCircle2,
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    school_joined: {
      icon: UserPlus,
      tone: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
    },
    trial_started: {
      icon: Clock,
      tone: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
    },
    billing_event: {
      icon: Banknote,
      tone: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
    },
  };

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Activity
        </p>
        <CardTitle className="text-base">Across the platform</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ul className="space-y-0.5">
          {PLATFORM_ACTIVITY.map((item) => {
            const { icon: Icon, tone } = ICON[item.kind];
            return (
              <li key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-card">
                <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", tone)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">
                    <span className="font-medium text-foreground">{item.actor}</span>{" "}
                    <span className="text-muted-foreground">{item.body}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.ago} ago</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function PlatformQuickActionsCard() {
  const items = [
    { icon: Plus, label: "Create new league", href: "/platform/leagues/new", tone: "crimson" as const },
    { icon: Users, label: "Invite a league owner", href: "#", tone: "default" as const, soon: true },
    { icon: Globe2, label: "Add game to library", href: "#", tone: "default" as const, soon: true },
    { icon: ShieldCheck, label: "Suspend a league", href: "#", tone: "default" as const, soon: true },
    { icon: Banknote, label: "Issue invoice", href: "#", tone: "default" as const, soon: true },
  ];

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Quick actions
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-[color:var(--brand-purple)]" />
          Platform operations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.soon ? "#" : item.href}
            className={cn(
              "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border/60 hover:bg-card",
              item.soon && "cursor-not-allowed opacity-50",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                item.tone === "crimson" && "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
                item.tone === "default" && "border-border bg-background text-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1 text-[13px] font-medium">{item.label}</span>
            {item.soon ? (
              <span className="rounded-full border border-border/60 px-1.5 py-0 text-[9px] uppercase tracking-wider text-muted-foreground">
                soon
              </span>
            ) : (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
