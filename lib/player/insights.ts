/**
 * Heuristic player insights.
 *
 * Pure function over a `PlayerProfile` — no DB calls, no LLM. Generates 2–4
 * short tip-style messages a player would actually read. The shape mirrors
 * what an LLM-backed version will return so we can swap implementations
 * without touching the UI.
 *
 * Rules are ordered by importance: the highest-priority rule that fires
 * is shown first. We cap output at MAX_INSIGHTS to avoid noise.
 */

import type { PlayerProfile } from "@/lib/player/data";

export type InsightTone = "positive" | "neutral" | "warning" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  // Optional source description so the player understands where this came from
  // ("Based on your last 5 matches", etc.) — keeps trust high vs LLM hallucination.
  source?: string;
};

const MAX_INSIGHTS = 4;

export function generateInsights(profile: PlayerProfile): Insight[] {
  const out: Insight[] = [];
  const { stats, recentResults, upcoming, teams } = profile;

  // --- High-priority signals --------------------------------------------

  // 1. No matches yet — onboarding tone
  if (stats.matchesPlayed === 0) {
    out.push({
      id: "no-matches",
      tone: "info",
      title: "Welcome — your first match is coming up",
      body:
        upcoming[0]
          ? `You're scheduled to play ${upcoming[0].opponentTeamName} on ${upcoming[0].scheduledAt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}. Good luck.`
          : "Once your team's first match lands on the schedule, you'll see it here.",
      source: "First-match onboarding",
    });
    return out;
  }

  // 2. Forfeit warning — biggest win-rate killer
  const last5 = recentResults;
  const last5Forfeits = last5.filter((m) => m.result === "FORFEIT_BY_US").length;
  if (last5Forfeits >= 2) {
    out.push({
      id: "forfeit-warning",
      tone: "warning",
      title: `${last5Forfeits} of your last ${last5.length} matches were forfeits`,
      body: "Attendance is the single biggest leverage on your win rate. If schedule conflicts are recurring, ask your coach to reschedule earlier in the week.",
      source: `Last ${last5.length} matches`,
    });
  }

  // 3. Win streak ≥ 3 — celebrate
  if (stats.currentStreak.kind === "WIN" && stats.currentStreak.length >= 3) {
    out.push({
      id: "win-streak",
      tone: "positive",
      title: `${stats.currentStreak.length}-game win streak`,
      body:
        stats.currentStreak.length >= stats.longestWinStreak
          ? "Your longest streak of the season. Keep the prep routine you're using."
          : "Solid run. Stay focused on the same prep and com habits.",
      source: "Recent results",
    });
  }

  // 4. Loss streak ≥ 3 — empathetic + actionable
  if (stats.currentStreak.kind === "LOSS" && stats.currentStreak.length >= 3) {
    out.push({
      id: "loss-streak",
      tone: "warning",
      title: `${stats.currentStreak.length}-game cold streak`,
      body: "Tough patch. Pull up the last 3 match VODs together with your team — patterns are usually visible after a 30-min review session.",
      source: "Recent results",
    });
  }

  // --- Mid-priority signals ---------------------------------------------

  // 5. Rolling vs season win rate divergence (improving / declining)
  if (stats.matchesPlayed >= 6 && Math.abs(stats.rolling5WinRate - stats.winRate) >= 15) {
    if (stats.rolling5WinRate > stats.winRate) {
      out.push({
        id: "trending-up",
        tone: "positive",
        title: "Trending up",
        body: `Last-5 win rate ${stats.rolling5WinRate.toFixed(0)}% vs season ${stats.winRate.toFixed(0)}%. Whatever you changed recently is working.`,
        source: "Rolling 5-game window vs season",
      });
    } else {
      out.push({
        id: "trending-down",
        tone: "warning",
        title: "Trending down",
        body: `Last-5 win rate ${stats.rolling5WinRate.toFixed(0)}% vs season ${stats.winRate.toFixed(0)}%. Worth a quick check-in with your coach about what changed in the last two weeks.`,
        source: "Rolling 5-game window vs season",
      });
    }
  }

  // 6. Per-game variance — pinpoint best/worst title
  if (stats.byGame.length >= 2) {
    const best = stats.byGame.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    const worst = stats.byGame.reduce((a, b) => (a.winRate < b.winRate ? a : b));
    if (best.matches >= 2 && worst.matches >= 2 && best.winRate - worst.winRate >= 30) {
      out.push({
        id: "game-variance",
        tone: "info",
        title: `Strongest in ${best.game}`,
        body: `${best.winRate.toFixed(0)}% in ${best.game} (${best.wins}/${best.matches}) vs ${worst.winRate.toFixed(0)}% in ${worst.game}. Lean into your strongest title for upcoming bracket play.`,
        source: "Per-game breakdown",
      });
    }
  }

  // 7. Single-game player — encourage range
  if (stats.byGame.length === 1 && stats.matchesPlayed >= 4) {
    out.push({
      id: "single-game",
      tone: "info",
      title: "All-in on one title",
      body: `You've only played ${stats.byGame[0].game} this season. If your school fields another roster, ask your coach about cross-rostering — flex players have higher recruit interest.`,
      source: "Per-game breakdown",
    });
  }

  // --- Low-priority signals ---------------------------------------------

  // 8. Captain on multiple teams — recognition
  const captainTeams = teams.filter((t) => t.role === "CAPTAIN").length;
  if (captainTeams >= 2) {
    out.push({
      id: "multi-captain",
      tone: "positive",
      title: `Captain on ${captainTeams} teams`,
      body: "Coaches notice players who lead across multiple programs. Add a short bio + season highlights to your profile when that ships.",
      source: "Roster roles",
    });
  }

  // 9. Perfect attendance — celebrate the easy wins
  if (stats.matchesPlayed >= 4 && stats.attendanceRate === 100) {
    out.push({
      id: "perfect-attendance",
      tone: "positive",
      title: "Perfect attendance",
      body: `${stats.matchesPlayed} matches, zero forfeits. That alone puts you ahead of most rosters in the league.`,
      source: "Forfeit log",
    });
  }

  // 10. No upcoming matches — return signal
  if (upcoming.length === 0) {
    out.push({
      id: "no-upcoming",
      tone: "info",
      title: "Nothing scheduled yet",
      body: "Your team doesn't have a match on the calendar right now. Coaches usually publish the next match window 3–5 days out.",
      source: "Schedule",
    });
  }

  return out.slice(0, MAX_INSIGHTS);
}
