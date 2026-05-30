/**
 * Right-sidebar widgets for the player profile page. All server-rendered.
 * Real data comes from PlayerProfile (next match, goal). Mock data for
 * widgets without schema yet (props, follows, trending, achievements).
 */

import {
  Bell,
  CalendarDays,
  Crown,
  Flame,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlayerMatchRow, PlayerGoalRow } from "@/lib/player/data";
import {
  type Achievement,
  type TeamProp,
  type TrendingPlayer,
  type WhoToFollow,
} from "@/lib/player/social-mock";

const TONE_BG: Record<TeamProp["tone"] | Achievement["tone"], string> = {
  crimson:
    "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  purple:
    "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
};

// --- Wrapper card -----------------------------------------------------

function WidgetCard({
  eyebrow,
  title,
  icon: Icon,
  iconTone = "crimson",
  rightLink,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  iconTone?: "crimson" | "gold" | "purple" | "emerald";
  rightLink?: { label: string; href: string };
  children: React.ReactNode;
}) {
  const iconClass = {
    crimson: "text-[color:var(--brand-crimson)]",
    gold: "text-[color:var(--brand-gold)]",
    purple: "text-[color:var(--brand-purple)]",
    emerald: "text-emerald-500",
  }[iconTone];

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
          <CardTitle className="mt-1 flex items-center gap-2 text-[15px]">
            <Icon className={cn("h-4 w-4", iconClass)} />
            {title}
          </CardTitle>
        </div>
        {rightLink ? (
          <a
            href={rightLink.href}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {rightLink.label}
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

// --- WIDGET 1: Next Match (real) --------------------------------------

export function NextMatchWidget({ match }: { match: PlayerMatchRow | null }) {
  if (!match) {
    return (
      <WidgetCard eyebrow="Next match" title="Nothing scheduled" icon={CalendarDays}>
        <p className="text-[12px] text-muted-foreground">
          Your team&apos;s next match window will appear here.
        </p>
      </WidgetCard>
    );
  }

  const dateStr = match.scheduledAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeStr = match.scheduledAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const daysAway = Math.max(
    0,
    Math.ceil((match.scheduledAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  return (
    <Card className="border-[color:var(--brand-crimson)]/40 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Next match
        </p>
        <span className="rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-crimson)]">
          {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway} days`}
        </span>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[11px] font-bold text-white">
              {match.ownTeamName.split(" ").slice(0, 1).join("").slice(0, 3).toUpperCase()}
            </div>
            <p className="text-center text-[11px] font-semibold leading-tight">
              {firstWord(match.ownTeamName)}
            </p>
            <p className="text-[10px] text-muted-foreground">{secondPart(match.ownTeamName)}</p>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            vs
          </span>
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-[11px] font-bold text-white">
              {match.opponentTeamName.split(" ").slice(0, 1).join("").slice(0, 3).toUpperCase()}
            </div>
            <p className="text-center text-[11px] font-semibold leading-tight">
              {firstWord(match.opponentTeamName)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {secondPart(match.opponentTeamName)}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 text-[12px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>
              {dateStr} · {timeStr}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{match.competitionName}</span>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
        >
          <Bell className="h-3.5 w-3.5" />
          Check-in Reminder
        </button>
      </CardContent>
    </Card>
  );
}

// --- WIDGET 2: Season Goal (real) -------------------------------------

export function SeasonGoalWidget({ goal }: { goal: PlayerGoalRow | null }) {
  if (!goal) {
    return (
      <WidgetCard eyebrow="Season goal" title="No active goal" icon={Target} iconTone="purple">
        <p className="text-[12px] text-muted-foreground">
          Set a goal to track your progress this season.
        </p>
      </WidgetCard>
    );
  }

  const remaining = Math.max(0, goal.targetValue - goal.currentValue);
  return (
    <WidgetCard
      eyebrow="Season goal"
      title={goal.label}
      icon={Target}
      iconTone="purple"
      rightLink={{ label: "View Goals", href: "/me/goals" }}
    >
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-mono font-bold tabular-nums">
          {Math.round(goal.currentValue)} / {Math.round(goal.targetValue)}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all",
            goal.achieved ? "bg-emerald-500" : "bg-[color:var(--brand-crimson)]",
          )}
          style={{ width: `${goal.progressPct}%` }}
        />
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[color:var(--brand-purple)]/25 bg-[color:var(--brand-purple)]/5 p-2.5">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-purple)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold leading-tight">REWARD</p>
          <p className="text-[12px] font-semibold">Silver Tier Badge</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {goal.achieved
              ? "Unlocked! 🎉"
              : `${remaining.toFixed(remaining < 1 && remaining > 0 ? 1 : 0)} more to unlock`}
          </p>
        </div>
      </div>
    </WidgetCard>
  );
}

// --- WIDGET 3: Team Props ---------------------------------------------

export function TeamPropsWidget({
  props,
  total,
  voterInitials,
}: {
  props: TeamProp[];
  total: number;
  voterInitials: string[];
}) {
  return (
    <WidgetCard
      eyebrow="Team props"
      title={`${total} props from teammates`}
      icon={Sparkles}
      iconTone="purple"
      rightLink={{ label: "View all", href: "#" }}
    >
      <div className="mb-3 flex items-center -space-x-1.5">
        {voterInitials.slice(0, 5).map((init, i) => (
          <div
            key={i}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-gradient-to-br from-zinc-700 to-zinc-900 text-[9px] font-semibold text-white"
          >
            {init}
          </div>
        ))}
        {voterInitials.length > 5 ? (
          <span className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-card text-[10px] font-bold text-muted-foreground">
            +{voterInitials.length - 5}
          </span>
        ) : null}
      </div>
      <ul className="space-y-2">
        {props.map((p) => {
          const propIcon = p.label.includes("Clutch") ? Flame : p.label.includes("IGL") ? Crown : Trophy;
          const Icon = propIcon;
          return (
            <li key={p.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border",
                    TONE_BG[p.tone],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] font-medium">{p.label}</span>
              </div>
              <span className="font-mono text-[13px] font-bold tabular-nums text-muted-foreground">
                {p.count}
              </span>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

// --- WIDGET 4: Who to Follow ------------------------------------------

export function WhoToFollowWidget({ items }: { items: WhoToFollow[] }) {
  return (
    <WidgetCard
      eyebrow="Who to follow"
      title="Discover players"
      icon={UserPlus}
      iconTone="emerald"
      rightLink={{ label: "View all", href: "#" }}
    >
      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p.handle} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white",
                p.avatarTone,
              )}
            >
              {p.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{p.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">@{p.handle}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[12px] font-semibold text-foreground transition-colors hover:border-[color:var(--brand-crimson)]/40 hover:bg-[color:var(--brand-crimson)]/10 hover:text-[color:var(--brand-crimson)]"
            >
              Follow
            </button>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

// --- WIDGET 5: Trending Players ---------------------------------------

export function TrendingPlayersWidget({ players }: { players: TrendingPlayer[] }) {
  return (
    <WidgetCard
      eyebrow="Trending"
      title="Players to watch"
      icon={TrendingUp}
      iconTone="gold"
      rightLink={{ label: "View all", href: "#" }}
    >
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.name} className="flex items-center gap-3 py-1">
            <span className="w-5 text-center font-mono text-[12px] font-bold tabular-nums text-muted-foreground">
              {p.rank}
            </span>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white",
                p.avatarTone,
              )}
            >
              {p.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{p.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{p.school}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[14px] font-bold tabular-nums">{p.kd.toFixed(2)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">K/D</p>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

// --- WIDGET 6: Recent Achievements ------------------------------------

export function RecentAchievementsWidget({ items }: { items: Achievement[] }) {
  const ACHIEVEMENT_ICON: Record<Achievement["tone"], LucideIcon> = {
    crimson: Flame,
    gold: Crown,
    purple: Sparkles,
    emerald: ShieldCheck,
  };
  return (
    <WidgetCard
      eyebrow="Recent achievements"
      title="What you've earned"
      icon={Trophy}
      iconTone="gold"
      rightLink={{ label: "View all", href: "#" }}
    >
      <ul className="space-y-2.5">
        {items.map((a) => {
          const Icon = ACHIEVEMENT_ICON[a.tone];
          return (
            <li key={a.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                  TONE_BG[a.tone],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{a.label}</p>
                <p className="text-[11px] text-muted-foreground">{a.postedAt}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

// --- Helpers ----------------------------------------------------------

function firstWord(s: string): string {
  return s.split(" ")[0];
}
function secondPart(s: string): string {
  return s.split(" ").slice(1).join(" ").replace(/^—\s*/, "") || "Team";
}
