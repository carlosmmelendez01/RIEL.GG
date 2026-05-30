/**
 * Public league data layer.
 *
 * Powers the unauthenticated `/league/[slug]` pages — anyone can read a
 * league's public profile, season schedule, and standings. No auth gate,
 * but every query is read-only and only surfaces public-safe fields.
 *
 * Returns null when the league slug doesn't exist — caller renders 404.
 */

import { prisma } from "@/lib/db/prisma";

// --- Types --------------------------------------------------------------

export type PublicLeagueHero = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  primaryColor: string | null;
  classification: string;
  // Headline stats
  schoolCount: number;
  teamCount: number;
  playerCount: number;
  matchesPlayed: number;
};

export type PublicLeagueSeason = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  competitionCount: number;
  teamCount: number;
  matchesPlayed: number;
  matchesTotal: number;
};

export type PublicLeagueCompetition = {
  id: string;
  name: string;
  game: string;
  tier: string;
  state: string;
  status: string;
  registeredTeams: number;
  matchesPlayed: number;
  matchesTotal: number;
};

export type PublicLeagueSchool = {
  id: string;
  name: string;
  shortName: string | null;
  city: string | null;
  state: string | null;
  teamCount: number;
};

export type PublicLeagueData = {
  league: PublicLeagueHero;
  seasons: PublicLeagueSeason[];
  // Schools that play in this league (capped for the directory view)
  schools: PublicLeagueSchool[];
};

// --- Loaders ------------------------------------------------------------

export async function loadPublicLeague(slug: string): Promise<PublicLeagueData | null> {
  const league = await prisma.league.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      primaryColor: true,
      classification: true,
      _count: { select: { memberships: true } },
      memberships: {
        select: {
          school: {
            select: {
              id: true,
              name: true,
              shortName: true,
              city: true,
              state: true,
              teams: {
                select: {
                  id: true,
                  rosters: {
                    select: { _count: { select: { members: true } } },
                  },
                },
              },
            },
          },
        },
      },
      seasons: {
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          competitions: {
            select: {
              id: true,
              rosters: { select: { id: true } },
              stages: {
                select: {
                  _count: { select: { matches: true } },
                  matches: {
                    where: { status: { in: ["FINISHED", "FORFEITED"] } },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!league) return null;

  // Aggregate across all seasons / competitions
  let teamCount = 0;
  let playerCount = 0;
  let matchesPlayed = 0;
  for (const m of league.memberships) {
    for (const t of m.school.teams) {
      teamCount += 1;
      for (const r of t.rosters) {
        playerCount += r._count.members;
      }
    }
  }
  for (const s of league.seasons) {
    for (const c of s.competitions) {
      for (const st of c.stages) {
        matchesPlayed += st.matches.length;
      }
    }
  }

  const hero: PublicLeagueHero = {
    id: league.id,
    name: league.name,
    slug: league.slug,
    description: league.description,
    primaryColor: league.primaryColor,
    classification: league.classification,
    schoolCount: league._count.memberships,
    teamCount,
    playerCount,
    matchesPlayed,
  };

  const seasons: PublicLeagueSeason[] = league.seasons.map((s) => {
    const compCount = s.competitions.length;
    let seasonTeams = 0;
    let seasonMatchesPlayed = 0;
    let seasonMatchesTotal = 0;
    for (const c of s.competitions) {
      seasonTeams += c.rosters.length;
      for (const st of c.stages) {
        seasonMatchesTotal += st._count.matches;
        seasonMatchesPlayed += st.matches.length;
      }
    }
    return {
      id: s.id,
      name: s.name,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      competitionCount: compCount,
      teamCount: seasonTeams,
      matchesPlayed: seasonMatchesPlayed,
      matchesTotal: seasonMatchesTotal,
    };
  });

  const schools: PublicLeagueSchool[] = league.memberships
    .map((m) => ({
      id: m.school.id,
      name: m.school.name,
      shortName: m.school.shortName,
      city: m.school.city,
      state: m.school.state,
      teamCount: m.school.teams.length,
    }))
    .sort((a, b) => b.teamCount - a.teamCount || a.name.localeCompare(b.name));

  return { league: hero, seasons, schools };
}

// --- Season detail ------------------------------------------------------

export type PublicSeasonDetail = {
  league: { name: string; slug: string };
  season: { id: string; name: string; startsAt: Date; endsAt: Date };
  competitions: PublicLeagueCompetition[];
  recentResults: Array<{
    matchId: string;
    homeTeam: string;
    homeSchool: string;
    awayTeam: string;
    awaySchool: string;
    homeScore: number | null;
    awayScore: number | null;
    isForfeit: boolean;
    finishedAt: Date;
    game: string;
    competition: string;
  }>;
  standings: Array<{
    competitionId: string;
    competitionName: string;
    game: string;
    rows: Array<{
      rank: number;
      teamName: string;
      schoolShort: string;
      wins: number;
      losses: number;
    }>;
  }>;
};

export async function loadPublicSeason(
  leagueSlug: string,
  seasonId: string,
): Promise<PublicSeasonDetail | null> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      league: { select: { name: true, slug: true } },
      competitions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          skillTier: true,
          state: true,
          status: true,
          gameTitle: { select: { name: true } },
          rosters: {
            select: {
              id: true,
              team: {
                select: {
                  customName: true,
                  school: { select: { shortName: true, name: true } },
                },
              },
              homeMatches: {
                where: { status: "FINISHED" },
                select: { winnerRosterId: true },
              },
              awayMatches: {
                where: { status: "FINISHED" },
                select: { winnerRosterId: true },
              },
            },
          },
          stages: {
            select: {
              _count: { select: { matches: true } },
              matches: {
                where: { status: { in: ["FINISHED", "FORFEITED"] } },
                orderBy: { finishedAt: "desc" },
                take: 8,
                select: {
                  id: true,
                  homeScore: true,
                  awayScore: true,
                  isForfeit: true,
                  finishedAt: true,
                  homeRoster: {
                    select: {
                      team: {
                        select: {
                          customName: true,
                          school: { select: { shortName: true, name: true } },
                        },
                      },
                    },
                  },
                  awayRoster: {
                    select: {
                      team: {
                        select: {
                          customName: true,
                          school: { select: { shortName: true, name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!season) return null;
  if (season.league.slug !== leagueSlug) return null;

  const competitions: PublicLeagueCompetition[] = season.competitions.map((c) => {
    const matchesTotal = c.stages.reduce((s, st) => s + st._count.matches, 0);
    const matchesPlayed = c.stages.reduce((s, st) => s + st.matches.length, 0);
    return {
      id: c.id,
      name: c.name.replace(/^Spring 2026 — /, ""),
      game: c.gameTitle.name,
      tier: c.skillTier,
      state: c.state,
      status: c.status,
      registeredTeams: c.rosters.length,
      matchesPlayed,
      matchesTotal,
    };
  });

  // Standings per competition (cross-school by design — public)
  const standings = season.competitions.map((c) => ({
    competitionId: c.id,
    competitionName: c.name.replace(/^Spring 2026 — /, ""),
    game: c.gameTitle.name,
    rows: c.rosters
      .map((r) => {
        const all = [...r.homeMatches, ...r.awayMatches];
        const wins = all.filter((m) => m.winnerRosterId === r.id).length;
        const losses = all.length - wins;
        return {
          rosterId: r.id,
          teamName:
            r.team.customName ?? r.team.school.shortName ?? r.team.school.name,
          schoolShort: r.team.school.shortName ?? r.team.school.name,
          wins,
          losses,
        };
      })
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      .map((row, i) => ({
        rank: i + 1,
        teamName: row.teamName,
        schoolShort: row.schoolShort,
        wins: row.wins,
        losses: row.losses,
      })),
  }));

  // Recent results across all competitions
  const recentResults = season.competitions
    .flatMap((c) =>
      c.stages.flatMap((st) =>
        st.matches.map((m) => ({
          matchId: m.id,
          homeTeam:
            m.homeRoster?.team.customName ??
            m.homeRoster?.team.school.shortName ??
            m.homeRoster?.team.school.name ??
            "—",
          homeSchool:
            m.homeRoster?.team.school.shortName ?? m.homeRoster?.team.school.name ?? "—",
          awayTeam:
            m.awayRoster?.team.customName ??
            m.awayRoster?.team.school.shortName ??
            m.awayRoster?.team.school.name ??
            "—",
          awaySchool:
            m.awayRoster?.team.school.shortName ?? m.awayRoster?.team.school.name ?? "—",
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          isForfeit: m.isForfeit,
          finishedAt: m.finishedAt ?? new Date(),
          game: c.gameTitle.name,
          competition: c.name.replace(/^Spring 2026 — /, ""),
        })),
      ),
    )
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime())
    .slice(0, 15);

  return {
    league: season.league,
    season: {
      id: season.id,
      name: season.name,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
    },
    competitions,
    recentResults,
    standings,
  };
}

// --- Latest-season lookup for the /results redirect --------------------

export async function loadLatestPublicSeason(
  leagueSlug: string,
): Promise<{ leagueSlug: string; seasonId: string } | null> {
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: {
      seasons: {
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!league || league.seasons.length === 0) return null;
  return { leagueSlug, seasonId: league.seasons[0].id };
}
