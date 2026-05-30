import { BadgeCheck, Crown, Flame, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PlayerProfile } from "@/lib/player/data";
import type { ProfileMeta } from "@/lib/player/social-mock";

type HighlightCard = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  tone: "crimson" | "gold" | "emerald" | "purple";
};

const TONE_CARD: Record<HighlightCard["tone"], string> = {
  crimson:
    "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  purple:
    "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
};

const TONE_ICON: Record<HighlightCard["tone"], LucideIcon> = {
  crimson: Flame,
  gold: Crown,
  emerald: ShieldCheck,
  purple: Trophy,
};

export function ProfileHero({
  profile,
  meta,
  highlightCards,
}: {
  profile: PlayerProfile;
  meta: ProfileMeta;
  highlightCards: HighlightCard[];
}) {
  const { user, teams, stats } = profile;
  const primaryTeam = teams.find((t) => t.isStarter) ?? teams[0];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      {/* Banner */}
      <div className="relative h-40 overflow-hidden md:h-48">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-[color:var(--brand-crimson)]/40 via-[#0d0f14] to-[color:var(--brand-purple)]/30"
        />
        {/* Anime-silhouette stand-in: angled blocks suggesting a player portrait */}
        <div
          aria-hidden
          className="absolute right-[10%] top-1/2 h-44 w-32 -translate-y-1/2 rotate-3 rounded-2xl bg-gradient-to-br from-[color:var(--brand-crimson)]/40 via-[color:var(--brand-crimson)]/10 to-transparent blur-[2px]"
        />
        <div
          aria-hidden
          className="absolute right-[18%] top-[55%] h-24 w-20 -translate-y-1/2 -rotate-6 rounded-xl bg-gradient-to-br from-rose-700/40 via-transparent to-transparent blur-[1px]"
        />
        {/* Grid texture */}
        <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-30" />
        {/* School/team text watermark */}
        <p
          aria-hidden
          className="absolute right-6 top-1/2 -translate-y-1/2 select-none text-7xl font-black uppercase tracking-tight text-foreground/8 md:text-8xl"
        >
          {(user.schoolShortName ?? user.schoolName ?? "RIEL").slice(0, 7)}
        </p>
        {/* Bottom fade */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card/95 to-transparent"
        />
      </div>

      {/* Content row */}
      <div className="relative px-6 pb-6 pt-0 md:px-8 md:pb-8">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-end">
          {/* Avatar with rank badge */}
          <div className="relative -mt-14 md:-mt-16">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-1 rounded-full bg-[color:var(--brand-crimson)]/30 blur-md"
              />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-[color:var(--brand-crimson)] bg-background text-3xl font-bold tracking-tight text-foreground glow-crimson md:h-32 md:w-32 md:text-4xl">
                {user.initials}
              </div>
              {/* Online dot */}
              <span className="absolute bottom-2 right-2 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-emerald-500" />
              {/* Rank floating badge */}
              <span className="absolute -top-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-[color:var(--brand-gold)]/60 bg-[color:var(--brand-gold)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-gold)] backdrop-blur">
                <Crown className="h-3 w-3" />#{meta.rank}
              </span>
            </div>
          </div>

          {/* Identity */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{user.fullName}</h1>
              {meta.verified ? (
                <BadgeCheck className="h-6 w-6 text-[color:var(--brand-crimson)]" />
              ) : null}
              <span className="text-[14px] text-muted-foreground">@{meta.handle}</span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              {user.schoolName ? (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-crimson)]" />
                  {user.schoolName}
                </span>
              ) : null}
              {primaryTeam ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    {capitalize(primaryTeam.role)} · {primaryTeam.game}
                  </span>
                </>
              ) : null}
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {meta.tags.map((tag, i) => (
                <span
                  key={tag}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
                    i === 0
                      ? "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]"
                      : "border-border/60 bg-card text-muted-foreground",
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Quote */}
            <blockquote className="mt-4 max-w-md border-l-2 border-[color:var(--brand-crimson)]/60 pl-3 text-[13px] italic leading-relaxed text-muted-foreground">
              &ldquo;{meta.quote}&rdquo;
            </blockquote>

            {/* Social stats */}
            <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <SocialStat label="Posts" value={meta.posts.toLocaleString()} />
              <SocialStat label="Followers" value={meta.followers.toLocaleString()} />
              <SocialStat label="Following" value={meta.following.toLocaleString()} />
              <SocialStat label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} highlight />
              <SocialStat label={meta.rankScope} value={`#${meta.rank}`} highlight />
            </div>
          </div>

          {/* Highlight cards (right side) */}
          <div className="grid w-full grid-cols-2 gap-2 lg:w-72 lg:grid-cols-1">
            {highlightCards.map((c) => {
              const Icon = TONE_ICON[c.tone];
              return (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-lg border bg-card/80 p-3 transition-colors hover:bg-card",
                    TONE_CARD[c.tone],
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-90">
                        {c.label}
                      </p>
                      <p className="text-[15px] font-bold tracking-tight text-foreground">
                        {c.value}
                      </p>
                      {c.sub ? (
                        <p className="text-[10px] text-muted-foreground">{c.sub}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-lg font-bold tracking-tight tabular-nums md:text-xl",
          highlight && "text-[color:var(--brand-crimson)]",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
