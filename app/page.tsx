/**
 * Public homepage.
 *
 * Server component — pulls real counts from the DB so the stats strip,
 * hero "live match" card, featured-leagues row, and games-supported row
 * all reflect what's actually in the platform.
 */

import { FeaturedLeagues } from "@/components/marketing/featured-leagues";
import { GamesSupported } from "@/components/marketing/games-supported";
import { Hero } from "@/components/marketing/hero";
import {
  FinalCta,
  StatsStrip,
  Testimonials,
  WhySchools,
} from "@/components/marketing/sections";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { prisma } from "@/lib/db/prisma";

export default async function Home() {
  const [schoolCount, playerCount, gameCount, matchCount, leagueCount, liveMatches] =
    await Promise.all([
      prisma.school.count(),
      // "Players" = users with at least one RosterMembership
      prisma.user.count({ where: { rosterMemberships: { some: {} } } }),
      prisma.gameTitle.count({ where: { active: true } }),
      prisma.match.count({
        where: { OR: [{ status: "FINISHED" }, { status: "FORFEITED" }] },
      }),
      prisma.league.count(),
      prisma.match.count({
        where: { status: { in: ["IN_PROGRESS", "CHECKING_IN"] } },
      }),
    ]);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1 overflow-x-hidden">
        <Hero
          liveMatchCount={liveMatches}
          gamesCount={gameCount}
          schoolCount={schoolCount}
        />
        <StatsStrip
          schoolCount={schoolCount}
          playerCount={playerCount}
          gameCount={gameCount}
          matchCount={matchCount}
          leagueCount={leagueCount}
        />
        <FeaturedLeagues />
        <GamesSupported />
        <WhySchools />
        <Testimonials />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
