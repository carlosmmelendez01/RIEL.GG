/**
 * Bracket loader — shapes a single-elim playoff stage into a render-ready
 * grid (rounds as columns, each column a list of match cells or TBD
 * placeholders). Scoped to a league so admins/coaches can't read another
 * league's bracket by id.
 */

import { prisma } from "@/lib/db/prisma";

export type BracketSide = {
  rosterId: string;
  name: string;
  schoolShort: string;
  score: number | null;
  isWinner: boolean;
};

export type BracketCell = {
  matchId: string;
  status: string;
  finished: boolean;
  home: BracketSide | null;
  away: BracketSide | null;
};

export type BracketRound = {
  round: number;
  name: string;
  /** Length = slots in this round. `null` = a match that hasn't been generated yet. */
  slots: Array<BracketCell | null>;
};

export type BracketData = {
  competitionId: string;
  competitionName: string;
  game: string;
  /** False when the playoff stage exists but hasn't been seeded yet. */
  seeded: boolean;
  /** Set once the final is decided. */
  championName: string | null;
  rounds: BracketRound[];
};

function teamName(team: {
  customName: string | null;
  colorTag: string | null;
  school: { name: string; shortName: string | null };
  gameTitle: { name: string };
}): string {
  if (team.customName) return team.customName;
  const base = `${team.school.shortName ?? team.school.name} ${team.gameTitle.name}`;
  return team.colorTag ? `${base} ${team.colorTag}` : base;
}

function roundName(slotCount: number): string {
  switch (slotCount) {
    case 1:
      return "Finals";
    case 2:
      return "Semifinals";
    case 4:
      return "Quarterfinals";
    case 8:
      return "Round of 16";
    case 16:
      return "Round of 32";
    default:
      return `Round (${slotCount})`;
  }
}

const rosterSelect = {
  select: {
    id: true,
    team: {
      select: {
        customName: true,
        colorTag: true,
        school: { select: { name: true, shortName: true } },
        gameTitle: { select: { name: true } },
      },
    },
  },
} as const;

/**
 * Returns the bracket for a competition's single-elim stage, or null when the
 * competition doesn't exist / isn't in the league / has no single-elim stage.
 */
export async function loadCompetitionBracket(
  leagueId: string,
  competitionId: string,
): Promise<BracketData | null> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      name: true,
      gameTitle: { select: { name: true } },
      season: { select: { leagueId: true } },
      stages: {
        select: { id: true, kind: true, schedulingMethod: true },
      },
    },
  });
  if (!competition) return null;
  if (competition.season.leagueId !== leagueId) return null;

  const stage = competition.stages.find(
    (s) => s.kind === "SINGLE_ELIM" || s.schedulingMethod === "SINGLE_ELIM",
  );
  if (!stage) return null;

  const competitionName = competition.name.replace(/^Spring 2026 — /, "");
  const game = competition.gameTitle.name;

  const matches = await prisma.match.findMany({
    where: { stageId: stage.id },
    orderBy: [{ bracketRound: "asc" }, { bracketSlot: "asc" }],
    select: {
      id: true,
      status: true,
      homeScore: true,
      awayScore: true,
      winnerRosterId: true,
      bracketRound: true,
      bracketSlot: true,
      homeRoster: rosterSelect,
      awayRoster: rosterSelect,
    },
  });

  if (matches.length === 0) {
    return { competitionId, competitionName, game, seeded: false, championName: null, rounds: [] };
  }

  // Round-1 match count drives the full tree shape.
  const round1Count = matches.filter((m) => (m.bracketRound ?? 1) === 1).length;
  const totalRounds = Math.max(1, Math.round(Math.log2(round1Count)) + 1);

  const sideOf = (
    roster: (typeof matches)[number]["homeRoster"],
    score: number | null,
    winnerId: string | null,
  ): BracketSide | null => {
    if (!roster) return null;
    return {
      rosterId: roster.id,
      name: teamName(roster.team),
      schoolShort: roster.team.school.shortName ?? roster.team.school.name,
      score,
      isWinner: !!winnerId && winnerId === roster.id,
    };
  };

  const rounds: BracketRound[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const slotCount = Math.max(1, round1Count / Math.pow(2, r - 1));
    const slots: Array<BracketCell | null> = [];
    for (let s = 0; s < slotCount; s++) {
      const m = matches.find((x) => (x.bracketRound ?? 1) === r && (x.bracketSlot ?? 0) === s);
      if (!m) {
        slots.push(null);
        continue;
      }
      const finished = m.status === "FINISHED" || m.status === "FORFEITED";
      slots.push({
        matchId: m.id,
        status: m.status,
        finished,
        home: sideOf(m.homeRoster, m.homeScore, m.winnerRosterId),
        away: sideOf(m.awayRoster, m.awayScore, m.winnerRosterId),
      });
    }
    rounds.push({ round: r, name: roundName(slotCount), slots });
  }

  // Champion = winner of the final (last round, single slot), if finished.
  let championName: string | null = null;
  const final = rounds[rounds.length - 1]?.slots[0];
  if (final && final.finished) {
    const champ = final.home?.isWinner ? final.home : final.away?.isWinner ? final.away : null;
    championName = champ?.name ?? null;
  }

  return { competitionId, competitionName, game, seeded: true, championName, rounds };
}
