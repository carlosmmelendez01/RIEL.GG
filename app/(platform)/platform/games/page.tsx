import { Gamepad2, Plus, Search, Settings, TrendingUp, Trophy } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { PLATFORM_GAMES, PLATFORM_LEAGUES, type PlatformGame } from "@/lib/mock/platform";
import { cn } from "@/lib/utils";

// Per-game mock state — which leagues have it enabled, latest activity etc.
const GAME_USAGE: Record<string, { enabledByLeagues: number; activeCompetitions: number; matchesThisMonth: number; status: "ACTIVE" | "BETA" | "DEPRECATED" }> = {
  lol: { enabledByLeagues: 5, activeCompetitions: 7, matchesThisMonth: 412, status: "ACTIVE" },
  val: { enabledByLeagues: 5, activeCompetitions: 6, matchesThisMonth: 368, status: "ACTIVE" },
  rl: { enabledByLeagues: 5, activeCompetitions: 7, matchesThisMonth: 521, status: "ACTIVE" },
  ow2: { enabledByLeagues: 3, activeCompetitions: 3, matchesThisMonth: 141, status: "ACTIVE" },
  smash: { enabledByLeagues: 4, activeCompetitions: 5, matchesThisMonth: 198, status: "ACTIVE" },
  fortnite: { enabledByLeagues: 4, activeCompetitions: 4, matchesThisMonth: 232, status: "ACTIVE" },
  nba2k: { enabledByLeagues: 3, activeCompetitions: 2, matchesThisMonth: 78, status: "ACTIVE" },
  rivals: { enabledByLeagues: 1, activeCompetitions: 1, matchesThisMonth: 24, status: "BETA" },
  mariokart: { enabledByLeagues: 2, activeCompetitions: 2, matchesThisMonth: 96, status: "ACTIVE" },
  chess: { enabledByLeagues: 2, activeCompetitions: 1, matchesThisMonth: 64, status: "ACTIVE" },
};

export default function PlatformGamesPage() {
  const totalLeagues = PLATFORM_LEAGUES.length;
  const totalMatches = Object.values(GAME_USAGE).reduce((s, g) => s + g.matchesThisMonth, 0);

  return (
    <>
      <PlatformTopbar
        title="Game library"
        eyebrow={`${PLATFORM_GAMES.length} titles supported · ${totalMatches.toLocaleString()} matches this month across the platform`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Titles supported" value={String(PLATFORM_GAMES.length)} icon={Gamepad2} />
          <Stat label="Active competitions" value={String(Object.values(GAME_USAGE).reduce((s, g) => s + g.activeCompetitions, 0))} icon={Trophy} tone="crimson" />
          <Stat label="Matches this month" value={totalMatches.toLocaleString()} icon={TrendingUp} tone="gold" />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search titles…"
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <button
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
            )}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Add title
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PLATFORM_GAMES.map((g) => (
            <GameCard key={g.id} game={g} totalLeagues={totalLeagues} />
          ))}
        </div>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: typeof Gamepad2;
  tone?: "default" | "crimson" | "gold";
}) {
  const toneCls = {
    default: "border-border bg-background text-foreground",
    crimson: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
    gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  }[tone];
  return (
    <Card className="hover-edge-crimson border-border/60 bg-card/80 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md border", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

const STATUS_TONE = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  BETA: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  DEPRECATED: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

function GameCard({ game, totalLeagues }: { game: PlatformGame; totalLeagues: number }) {
  const usage = GAME_USAGE[game.id] ?? { enabledByLeagues: 0, activeCompetitions: 0, matchesThisMonth: 0, status: "ACTIVE" as const };
  const adoption = Math.round((usage.enabledByLeagues / Math.max(1, totalLeagues)) * 100);

  return (
    <Card className="group hover-edge-crimson border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-md bg-muted text-[15px] font-bold text-muted-foreground"
            >
              {game.name
                .split(" ")
                .filter((w) => /^[A-Z0-9]/.test(w))
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <CardTitle className="text-[15px] font-semibold tracking-tight">{game.name}</CardTitle>
              <p className="text-[11px] text-muted-foreground">{game.publisher}</p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              STATUS_TONE[usage.status],
            )}
          >
            {usage.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {game.formats.map((f) => (
            <span
              key={f}
              className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>

        <div>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>League adoption</span>
            <span className="font-mono tabular-nums text-foreground">
              {usage.enabledByLeagues}/{totalLeagues}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[color:var(--brand-crimson)]"
              style={{ width: `${adoption}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active comps</p>
            <p className="font-mono text-[14px] font-semibold tabular-nums">{usage.activeCompetitions}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Matches / mo</p>
            <p className="font-mono text-[14px] font-semibold tabular-nums">
              {usage.matchesThisMonth.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}>
            <Settings className="mr-1 h-3 w-3" />
            Configure
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
