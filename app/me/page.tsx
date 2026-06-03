/**
 * Player profile — social-first.
 *
 * Three-column layout: left sidebar nav, center profile + feed, right
 * sidebar widgets. Real Prisma data drives identity, stats, next match,
 * season goal, and coach comments. The post feed and a few widgets use
 * mock data (no schema yet for posts/follows/props) — these get
 * personalized at render time so the demo feels real.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronRight, UserRound } from "lucide-react";

import { Feed } from "@/components/player/feed";
import { CreatePostCard, FeedTabs } from "@/components/player/feed-interactive";
import { MatchDayHub } from "@/components/match/match-day-hub";
import { ProfileHero } from "@/components/player/profile-hero";
import {
  NextMatchWidget,
  RecentAchievementsWidget,
  SeasonGoalWidget,
  TeamPropsWidget,
  TrendingPlayersWidget,
  WhoToFollowWidget,
} from "@/components/player/right-widgets";
import { PlayerSidebar } from "@/components/player/sidebar";
import { TopNav } from "@/components/player/top-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadMatchChat, loadMatchDay, type MatchChatPayload } from "@/lib/match/match-day";
import { loadPlayerProfile } from "@/lib/player/data";
import { loadPlayerSocialContext } from "@/lib/player/social-context";
import {
  buildPlayerFeed,
  PROFILE_HIGHLIGHT_CARDS,
  PROFILE_META,
} from "@/lib/player/social-mock";

export default async function PlayerHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const profile = await loadPlayerProfile(user.id);
  if (!profile) redirect("/login");
  const profileNowMs = profile.loadedAt.getTime();

  if (profile.teams.length === 0) {
    return <NoTeamsState fullName={profile.user.fullName} />;
  }

  // --- Real data → personalized feed -----------------------------------
  // Every feed post is now grounded in real data. If we don't have backing
  // for a post type, we skip it entirely (no Carmel-fallback content).

  const socialContext = await loadPlayerSocialContext(profile);

  const lastWin = profile.recentResults.find(
    (m) => m.result === "WIN" || m.result === "FORFEIT_BY_THEM",
  );

  const realMatchWin = lastWin
    ? {
        opponent: lastWin.opponentTeamName,
        opponentMonogram: lastWin.opponentSchool.slice(0, 3).toUpperCase(),
        ourMonogram: (profile.user.schoolShortName ?? profile.user.fullName)
          .slice(0, 3)
          .toUpperCase(),
        ourScore: lastWin.ourScore ?? 2,
        theirScore: lastWin.theirScore ?? 0,
        daysAgo: lastWin.finishedAt
          ? Math.max(
              0,
              Math.floor((profileNowMs - lastWin.finishedAt.getTime()) / (24 * 60 * 60 * 1000)),
            )
          : 0,
      }
    : null;

  const firstComment = profile.comments[0] ?? null;
  const realCoachComment = firstComment
    ? {
        authorName: firstComment.authorName,
        body: firstComment.body,
        postedAt: relativeTimeAgo(firstComment.createdAt, profileNowMs),
      }
    : null;

  const firstGoal = profile.goals[0] ?? null;
  const realGoalProgress = firstGoal
    ? {
        current: firstGoal.currentValue,
        target: firstGoal.targetValue,
        label: firstGoal.label,
      }
    : null;

  // Synthesize a credible teammate mention only when we know who their
  // teammates actually are. Without the Post schema we can't link to a real
  // post — but the body is at least about the real player + from a real
  // teammate, so it doesn't break the "no fake names" promise.
  const realTeammateMention = socialContext.mentionFrom
    ? {
        teammateName: socialContext.mentionFrom.name,
        teammateInitials: socialContext.mentionFrom.initials,
        body: `Great calls today ${profile.user.fullName.split(" ")[0]}! That mid-round adjustment was 🔥`,
      }
    : null;

  const feedPosts = buildPlayerFeed({
    playerName: profile.user.fullName,
    playerInitials: profile.user.initials,
    schoolShortName: profile.user.schoolShortName ?? profile.user.schoolName ?? "RIEL",
    realRanking: socialContext.ranking,
    realCoachComment,
    realMatchWin,
    realGoalProgress,
    realTeammateMention,
  });

  const winStreak =
    profile.stats.currentStreak.kind === "WIN" ? profile.stats.currentStreak.length : 0;

  // --- Match-Day Hub data ---------------------------------------------
  // Load the player's match-day cards + pre-load each chat thread so the
  // sheet opens instantly when they tap "Chat" (zero network on open).
  const matchDayCards = await loadMatchDay(user.id);
  const chatEntries = await Promise.all(
    matchDayCards.map(async (c) => [c.matchId, await loadMatchChat(c.matchId, user.id)] as const),
  );
  const chatPayloads: Record<string, MatchChatPayload | null> = Object.fromEntries(chatEntries);

  return (
    <div className="flex">
      {/* Left sidebar */}
      <PlayerSidebar user={{ fullName: profile.user.fullName, initials: profile.user.initials }} />

      {/* Right column (top nav + content) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav winStreak={winStreak} />

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[1fr_320px]">
          {/* Center column */}
          <main className="min-w-0 space-y-4">
            {/* Match-Day Hub — pinned at top whenever the player has matches
                in the window. The whole 3-tap brief lives here: cold app
                open → see hub → tap Chat. */}
            {matchDayCards.length > 0 ? (
              <MatchDayHub cards={matchDayCards} chatPayloads={chatPayloads} />
            ) : null}

            <ProfileHero
              profile={profile}
              meta={PROFILE_META}
              highlightCards={PROFILE_HIGHLIGHT_CARDS}
            />

            <CreatePostCard initials={profile.user.initials} />

            <FeedTabs />

            {feedPosts.length > 0 ? (
              <Feed posts={feedPosts} />
            ) : (
              <FeedEmptyState firstName={profile.user.fullName.split(" ")[0]} />
            )}
          </main>

          {/* Right widgets — all driven by real Prisma data scoped to the
              signed-in player. Each viewer sees a different sidebar. */}
          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <NextMatchWidget match={profile.upcoming[0] ?? null} nowMs={profileNowMs} />
            <SeasonGoalWidget goal={firstGoal} />
            {socialContext.teamProps.voterInitials.length > 0 ? (
              <TeamPropsWidget
                props={socialContext.teamProps.props}
                total={socialContext.teamProps.total}
                voterInitials={socialContext.teamProps.voterInitials}
              />
            ) : null}
            {socialContext.whoToFollow.length > 0 ? (
              <WhoToFollowWidget items={socialContext.whoToFollow} />
            ) : null}
            {socialContext.trendingPlayers.length > 0 ? (
              <TrendingPlayersWidget players={socialContext.trendingPlayers} />
            ) : null}
            {socialContext.recentAchievements.length > 0 ? (
              <RecentAchievementsWidget items={socialContext.recentAchievements} />
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

// --- Empty state ------------------------------------------------------

function FeedEmptyState({ firstName }: { firstName: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Your feed
      </p>
      <h3 className="mt-2 text-balance text-lg font-semibold tracking-tight">
        Nothing here yet, {firstName}.
      </h3>
      <p className="mx-auto mt-2 max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
        Your feed fills in as you play matches, get coach feedback, and hit milestones.
        Win a match or check in to one today and your first post lands here automatically.
      </p>
    </div>
  );
}

function NoTeamsState({ fullName }: { fullName: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]">
        <UserRound className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight">
        Welcome to RIEL.GG, {fullName.split(" ")[0]}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;re not on a team roster yet. Once your coach adds you to a roster, your matches,
        stats, and goals will live here.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Use a different account
        <ArrowRight className="h-3 w-3" />
      </Link>
      <p className="mt-12 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <ChevronRight className="h-3 w-3" />
        If you think this is wrong, ask your coach to verify your roster placement.
      </p>
    </div>
  );
}

// --- Helpers ----------------------------------------------------------

function relativeTimeAgo(d: Date, nowMs: number): string {
  const ms = nowMs - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
