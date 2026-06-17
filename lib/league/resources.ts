import type {
  LeagueResourceAudience,
  LeagueResourceCategory,
} from "@prisma/client";

import { getCoachSchools } from "@/lib/coach/dashboard";
import { prisma } from "@/lib/db/prisma";

export const RESOURCE_CATEGORIES = [
  "GENERAL_RULES",
  "GAME_RULES",
  "MATCH_DAY",
  "LOBBY_SETUP",
  "ELIGIBILITY",
  "COMPLIANCE",
  "OTHER",
] as const satisfies readonly LeagueResourceCategory[];

export const RESOURCE_AUDIENCES = [
  "ALL",
  "COACHES",
  "PLAYERS",
  "STAFF",
] as const satisfies readonly LeagueResourceAudience[];

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export type ResourceAudience = (typeof RESOURCE_AUDIENCES)[number];

export type LeagueResourceRow = {
  id: string;
  leagueId: string;
  title: string;
  summary: string | null;
  body: string;
  url: string | null;
  category: ResourceCategory;
  audience: ResourceAudience;
  pinned: boolean;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  gameTitle: { id: string; name: string } | null;
  season: { id: string; name: string } | null;
  competition: { id: string; name: string; game: string } | null;
  createdByName: string;
  updatedByName: string | null;
};

export type LeagueResourceOption = {
  id: string;
  label: string;
};

export type LeagueResourceManagerData = {
  resources: LeagueResourceRow[];
  games: LeagueResourceOption[];
  seasons: LeagueResourceOption[];
  competitions: Array<LeagueResourceOption & { seasonId: string; gameTitleId: string }>;
};

export type CoachResourcesData = {
  schoolName: string;
  leagues: Array<{
    leagueId: string;
    leagueName: string;
    leagueSlug: string;
    resources: LeagueResourceRow[];
  }>;
};

const resourceInclude = {
  gameTitle: { select: { id: true, name: true } },
  season: { select: { id: true, name: true } },
  competition: {
    select: {
      id: true,
      name: true,
      gameTitle: { select: { name: true } },
    },
  },
  createdBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
} as const;

function shapeResource(row: {
  id: string;
  leagueId: string;
  title: string;
  summary: string | null;
  body: string;
  url: string | null;
  category: LeagueResourceCategory;
  audience: LeagueResourceAudience;
  pinned: boolean;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  gameTitle: { id: string; name: string } | null;
  season: { id: string; name: string } | null;
  competition: { id: string; name: string; gameTitle: { name: string } } | null;
  createdBy: { fullName: string };
  updatedBy: { fullName: string } | null;
}): LeagueResourceRow {
  return {
    id: row.id,
    leagueId: row.leagueId,
    title: row.title,
    summary: row.summary,
    body: row.body,
    url: row.url,
    category: row.category,
    audience: row.audience,
    pinned: row.pinned,
    published: row.published,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    gameTitle: row.gameTitle,
    season: row.season,
    competition: row.competition
      ? {
          id: row.competition.id,
          name: row.competition.name,
          game: row.competition.gameTitle.name,
        }
      : null,
    createdByName: row.createdBy.fullName,
    updatedByName: row.updatedBy?.fullName ?? null,
  };
}

export async function loadLeagueResourceManager(
  leagueId: string,
): Promise<LeagueResourceManagerData> {
  const [resources, games, seasons, competitions] = await Promise.all([
    prisma.leagueResource.findMany({
      where: { leagueId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      include: resourceInclude,
    }),
    prisma.gameTitle.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.season.findMany({
      where: { leagueId },
      orderBy: { startsAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.competition.findMany({
      where: { season: { leagueId } },
      orderBy: [{ season: { startsAt: "desc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        seasonId: true,
        gameTitleId: true,
        gameTitle: { select: { name: true } },
      },
    }),
  ]);

  return {
    resources: resources.map(shapeResource),
    games: games.map((game) => ({ id: game.id, label: game.name })),
    seasons: seasons.map((season) => ({ id: season.id, label: season.name })),
    competitions: competitions.map((competition) => ({
      id: competition.id,
      label: `${competition.name.replace(/^Spring 2026 — /, "")} · ${competition.gameTitle.name}`,
      seasonId: competition.seasonId,
      gameTitleId: competition.gameTitleId,
    })),
  };
}

export async function loadPublicLeagueResources(slug: string): Promise<{
  league: { id: string; name: string; slug: string; description: string | null };
  resources: LeagueResourceRow[];
} | null> {
  const league = await prisma.league.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      resources: {
        where: { published: true, audience: "ALL" },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        include: resourceInclude,
      },
    },
  });
  if (!league) return null;
  return {
    league: {
      id: league.id,
      name: league.name,
      slug: league.slug,
      description: league.description,
    },
    resources: league.resources.map(shapeResource),
  };
}

export async function loadCoachResources(userId: string): Promise<CoachResourcesData | null> {
  const schools = await getCoachSchools(userId);
  if (schools.length === 0) return null;

  const schoolIds = schools.map((school) => school.id);
  const memberships = await prisma.leagueMembership.findMany({
    where: { schoolId: { in: schoolIds }, status: "ACTIVE" },
    select: {
      league: {
        select: {
          id: true,
          name: true,
          slug: true,
          resources: {
            where: {
              published: true,
              audience: { in: ["ALL", "COACHES"] },
            },
            orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
            include: resourceInclude,
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const byLeague = new Map<string, CoachResourcesData["leagues"][number]>();
  for (const membership of memberships) {
    const league = membership.league;
    if (byLeague.has(league.id)) continue;
    byLeague.set(league.id, {
      leagueId: league.id,
      leagueName: league.name,
      leagueSlug: league.slug,
      resources: league.resources.map(shapeResource),
    });
  }

  return {
    schoolName: schools[0].name,
    leagues: Array.from(byLeague.values()),
  };
}

export function categoryLabel(category: ResourceCategory): string {
  switch (category) {
    case "GENERAL_RULES":
      return "General rules";
    case "GAME_RULES":
      return "Game rules";
    case "MATCH_DAY":
      return "Match day";
    case "LOBBY_SETUP":
      return "Lobby setup";
    case "ELIGIBILITY":
      return "Eligibility";
    case "COMPLIANCE":
      return "Compliance";
    case "OTHER":
      return "Other";
  }
}

export function audienceLabel(audience: ResourceAudience): string {
  switch (audience) {
    case "ALL":
      return "Everyone";
    case "COACHES":
      return "Coaches";
    case "PLAYERS":
      return "Players";
    case "STAFF":
      return "Staff";
  }
}
