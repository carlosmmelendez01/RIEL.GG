/**
 * Feed (server-rendered) — renders the full posts array as PostCards. The
 * interactive create-post box + tab bar are split into a sibling client
 * file (feed-interactive.tsx) to keep the post rendering pure / cacheable.
 */

import {
  BadgeCheck,
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Play,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/lib/player/social-mock";

export function Feed({ posts }: { posts: FeedPost[] }) {
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

// --- PostCard ----------------------------------------------------------

function PostCard({ post }: { post: FeedPost }) {
  return (
    <article
      className={cn(
        "group rounded-2xl border bg-card/60 p-4 transition-all hover:border-border hover:bg-card hover:shadow-[0_0_30px_-12px_oklch(0.4555_0.1734_19.27/40%)] md:p-5",
        post.pinned ? "border-[color:var(--brand-crimson)]/30" : "border-border/60",
      )}
    >
      {post.pinned ? (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-crimson)]">
          <Pin className="h-3 w-3" />
          Pinned Post
        </div>
      ) : null}

      {/* Author row */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-semibold tracking-tight text-white",
            post.author.avatarTone,
          )}
        >
          {post.author.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-[14px] font-semibold leading-none">{post.author.name}</span>
            {post.author.verified ? (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 -translate-y-px text-[color:var(--brand-crimson)]" />
            ) : null}
            {post.author.badge ? (
              <span className="rounded-md border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[color:var(--brand-gold)]">
                {post.author.badge}
              </span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">@{post.author.handle}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-[11px] text-muted-foreground">{post.postedAt}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
          aria-label="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0">
          {post.emoji ? (
            <p className="mb-1 text-[15px] font-semibold leading-snug">
              <span className="mr-1.5 text-[18px]">{post.emoji}</span>
              {firstLine(post.body)}
            </p>
          ) : (
            <p className="text-[14px] leading-relaxed text-foreground">{firstLine(post.body)}</p>
          )}
          {restLines(post.body).map((line, i) => (
            <p key={i} className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {line}
            </p>
          ))}
        </div>

        {/* Inline payload card */}
        {post.rankCard ? <RankCard rank={post.rankCard} /> : null}
        {post.matchResult ? <MatchResultCard match={post.matchResult} /> : null}
        {post.highlight ? <HighlightCard highlight={post.highlight} /> : null}
        {post.goalProgress ? <GoalProgressCard goal={post.goalProgress} /> : null}
      </div>

      {/* Engagement row */}
      <div className="mt-4 flex items-center gap-1 border-t border-border/60 pt-3 text-[12px] text-muted-foreground">
        <Engagement icon={Heart} count={post.likes} hoverTone="text-[color:var(--brand-crimson)]" />
        <Engagement icon={MessageCircle} count={post.comments} hoverTone="text-sky-400" />
        <Engagement icon={Repeat2} count={post.shares} hoverTone="text-emerald-500" />
        <button
          type="button"
          className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-[color:var(--brand-gold)]"
          aria-label="Bookmark"
        >
          <Bookmark className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function Engagement({
  icon: Icon,
  count,
  hoverTone,
}: {
  icon: LucideIcon;
  count: number;
  hoverTone: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "group inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-card",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 transition-colors group-hover:" + hoverTone)} />
      <span className="font-mono tabular-nums">{count}</span>
    </button>
  );
}

function firstLine(body: string): string {
  return body.split("\n")[0];
}
function restLines(body: string): string[] {
  return body.split("\n").slice(1).filter(Boolean);
}

// --- Inline payload cards ---------------------------------------------

function RankCard({ rank }: { rank: { rank: number; scope: string; subtitle: string } }) {
  return (
    <div className="relative w-full max-w-[200px] overflow-hidden rounded-xl border border-[color:var(--brand-crimson)]/30 bg-gradient-to-br from-[color:var(--brand-crimson)]/15 via-card to-background p-4 text-center md:w-[200px]">
      {/* Indiana state outline placeholder — abstract diamond shape */}
      <svg
        viewBox="0 0 120 130"
        aria-hidden
        className="absolute inset-x-1/2 top-2 h-24 w-24 -translate-x-1/2 stroke-[color:var(--brand-crimson)]/40"
        fill="none"
        strokeWidth="1.5"
      >
        <path d="M30 8 L88 8 L92 38 L98 70 L88 110 L40 122 L18 100 L12 50 Z" />
      </svg>
      <div className="relative pt-2">
        <Trophy className="mx-auto h-4 w-4 text-[color:var(--brand-gold)]" />
        <p className="mt-2 text-3xl font-black tracking-tight text-[color:var(--brand-crimson)]">
          #{rank.rank}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {rank.scope}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">{rank.subtitle}</p>
      </div>
    </div>
  );
}

function MatchResultCard({
  match,
}: {
  match: NonNullable<FeedPost["matchResult"]>;
}) {
  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-xl border border-border/60 bg-card/80 md:w-[260px]">
      <div className="flex items-stretch divide-x divide-border/60">
        <div className="flex flex-1 flex-col items-center gap-1 p-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold text-white",
              match.homeTone,
            )}
          >
            {match.homeMonogram}
          </div>
          <p className="text-[11px] font-semibold leading-tight">{match.homeName.split(" ")[0]}</p>
          <p className="text-[10px] text-muted-foreground">
            {match.homeName.split(" ").slice(1).join(" ") || "Home"}
          </p>
        </div>
        <div className="flex w-[80px] shrink-0 flex-col items-center justify-center bg-background/40 p-3">
          <p className="font-mono text-2xl font-bold tabular-nums">
            {match.homeScore}
            <span className="px-1 text-muted-foreground">–</span>
            {match.awayScore}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {match.label}
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 p-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold text-white",
              match.awayTone,
            )}
          >
            {match.awayMonogram}
          </div>
          <p className="text-[11px] font-semibold leading-tight">{match.awayName.split(" ")[0]}</p>
          <p className="text-[10px] text-muted-foreground">
            {match.awayName.split(" ").slice(1).join(" ") || "Away"}
          </p>
        </div>
      </div>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: NonNullable<FeedPost["highlight"]> }) {
  return (
    <div className="relative aspect-video w-full max-w-[320px] overflow-hidden rounded-xl border border-border/60 bg-zinc-950 md:w-[320px]">
      {/* Stylized "screenshot" backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-orange-900/40 to-transparent"
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-[10%] h-12 w-24 rounded-md bg-gradient-to-br from-zinc-700/60 to-zinc-900/60"
      />
      {/* Crosshair overlay */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/80"
      />
      {/* Play button */}
      <button
        type="button"
        className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-transform hover:scale-105"
        aria-label={`Play highlight: ${highlight.title}`}
      >
        <Play className="ml-0.5 h-6 w-6 fill-current" />
      </button>
      {/* Duration */}
      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-white">
        {highlight.duration}
      </span>
    </div>
  );
}

function GoalProgressCard({ goal }: { goal: NonNullable<FeedPost["goalProgress"]> }) {
  const pct = (goal.current / goal.target) * 100;
  return (
    <Card className="w-full max-w-[280px] border-[color:var(--brand-purple)]/25 bg-card/80 p-3 md:w-[280px]">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[color:var(--brand-purple)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold">{goal.rewardLabel}</p>
          <p className="text-[10px] text-muted-foreground">Reward · 2 more wins to unlock</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">5 wins this season</span>
        <span className="font-mono font-bold tabular-nums">
          {goal.current} / {goal.target}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </Card>
  );
}

// Type-only re-export so consumers can import LucideIcon ergonomically.
export type { LucideIcon };

// Suppress unused warnings for icon imports we re-export pattern-wise
void Sparkles;
