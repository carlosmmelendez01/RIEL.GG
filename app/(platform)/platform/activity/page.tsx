import { Activity, Banknote, CheckCircle2, Clock, Filter, Sparkles, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  PLATFORM_ACTIVITY,
  PLATFORM_LEAGUES,
  type PlatformActivityItem,
} from "@/lib/mock/platform";
import { cn } from "@/lib/utils";

// Extend the activity feed with more events for a fuller demo
const EXTENDED_ACTIVITY: PlatformActivityItem[] = [
  ...PLATFORM_ACTIVITY,
  { id: "pa7", kind: "school_joined", leagueId: "lg-riel", actor: "Bishop Chatard HS", body: "joined RIEL Esports League", ago: "2h" },
  { id: "pa8", kind: "school_joined", leagueId: "lg-hea", actor: "Westfield HS", body: "joined Hoosier Esports Alliance", ago: "8h" },
  { id: "pa9", kind: "billing_event", leagueId: "lg-esohio", actor: "Esports Ohio", body: "purchased 5-school expansion (Tier 2 → Tier 2+)", ago: "1d" },
  { id: "pa10", kind: "league_activated", leagueId: "lg-michcollegiate", actor: "Dr. Anika Patel", body: "completed onboarding for Michigan Collegiate Esports", ago: "2w" },
  { id: "pa11", kind: "school_joined", leagueId: "lg-michcollegiate", actor: "Michigan State University", body: "joined Michigan Collegiate Esports", ago: "2w" },
  { id: "pa12", kind: "trial_started", leagueId: "lg-prairie", actor: "Steven Holm", body: "started 14-day trial for Prairie Conference Esports", ago: "3d" },
];

export default function PlatformActivityPage() {
  return (
    <>
      <PlatformTopbar
        title="Activity feed"
        eyebrow={`Events across all ${PLATFORM_LEAGUES.length} leagues — newest first`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            <span className="text-foreground font-medium">{EXTENDED_ACTIVITY.length}</span> events recorded ·
            All time
          </p>
          <div className="flex gap-2">
            <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Filter className="mr-1.5 h-3 w-3" />
              All leagues
            </button>
            <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Filter className="mr-1.5 h-3 w-3" />
              All event types
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ActivityList items={EXTENDED_ACTIVITY} />
          </div>
          <div className="space-y-4">
            <BreakdownCard items={EXTENDED_ACTIVITY} />
            <LeagueFilterCard />
          </div>
        </div>
      </main>
    </>
  );
}

const KIND_ICON: Record<
  PlatformActivityItem["kind"],
  { icon: LucideIcon; tone: string; label: string }
> = {
  league_created: {
    icon: Sparkles,
    tone: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
    label: "League created",
  },
  league_activated: {
    icon: CheckCircle2,
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    label: "League activated",
  },
  school_joined: {
    icon: UserPlus,
    tone: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
    label: "School joined",
  },
  trial_started: {
    icon: Clock,
    tone: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
    label: "Trial started",
  },
  billing_event: {
    icon: Banknote,
    tone: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
    label: "Billing",
  },
};

function ActivityList({ items }: { items: PlatformActivityItem[] }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Timeline
        </p>
        <CardTitle className="text-base">Latest events</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const meta = KIND_ICON[item.kind];
            const Icon = meta.icon;
            const league = item.leagueId
              ? PLATFORM_LEAGUES.find((l) => l.id === item.leagueId)
              : null;
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-card"
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                    meta.tone,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">
                    <span className="font-semibold text-foreground">{item.actor}</span>{" "}
                    <span className="text-muted-foreground">{item.body}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className={cn("rounded-sm border px-1.5 py-0", meta.tone)}>{meta.label}</span>
                    {league ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ background: league.primaryColor }}
                        />
                        {league.shortName}
                      </span>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span>{item.ago} ago</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ items }: { items: PlatformActivityItem[] }) {
  const counts = items.reduce(
    (acc, item) => {
      acc[item.kind] = (acc[item.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<PlatformActivityItem["kind"], number>,
  );

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Event breakdown
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-[color:var(--brand-purple)]" />
          By type
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(KIND_ICON).map(([kind, meta]) => {
          const count = counts[kind as keyof typeof counts] ?? 0;
          if (count === 0) return null;
          const Icon = meta.icon;
          return (
            <div key={kind} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-background/40">
              <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", meta.tone)}>
                <Icon className="h-3 w-3" />
              </div>
              <span className="flex-1 text-[12px]">{meta.label}</span>
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{count}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LeagueFilterCard() {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          By league
        </p>
        <CardTitle className="text-base">Quick filter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {PLATFORM_LEAGUES.map((l) => (
          <button
            key={l.id}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-background/40"
          >
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: l.primaryColor }} />
            <span className="flex-1 truncate text-[12px]">{l.name}</span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {l.shortName}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
