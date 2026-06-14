/**
 * RIEL.GG database seed.
 *
 * Loads existing mock data from `lib/mock/*` into the real Postgres database.
 * Idempotent — safe to run multiple times. Uses `upsert` on natural unique keys
 * (slug, code, email) so re-running won't duplicate rows.
 *
 * Run: `npx prisma db seed` (or `npm run db:seed`)
 */

import { PrismaClient } from "@prisma/client";
import { PLATFORM_LEAGUES, PLATFORM_GAMES, PLATFORM_ACTIVITY } from "../lib/mock/platform";
import { SUPPORTED_GAMES, isSupportedGame } from "../lib/games/supported";
import {
  PLATFORM_SCHOOLS,
  PLATFORM_ADMINS,
  RIEL_STAFF,
  AUDIT_EVENTS,
  type PlatformAdmin,
} from "../lib/mock/platform-data";
import { TEAMS, MATCHES, ANNOUNCEMENTS, COACHES, MATCH_MESSAGES, MATCH_REPORTS } from "../lib/mock/data";

const prisma = new PrismaClient();

/**
 * Deterministic seeded RNG (mulberry32). Same seed string → same sequence.
 * Used by the synthetic-match generator so reseeds produce identical data.
 */
function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const FORMAT_PLAYER_COUNT: Record<string, number> = {
  "5v5": 5,
  "3v3": 3,
  "2v2": 2,
  "1v1": 1,
  Squads: 4,
  Duos: 2,
  Solo: 1,
  Crew: 4,
  "6v6": 6,
  "4v4 Team": 4,
  "Team Match": 5,
};

async function main() {
  console.log("\n=== RIEL.GG seed starting ===\n");

  // ============================================================
  // 1. Game catalog — titles + formats
  // ============================================================
  console.log("[1/10] Game catalog");
  const gameMap = new Map<string, string>(); // mock id → real id
  const formatMap = new Map<string, string>(); // `{gameId}:{format}` → real id

  // Seed source = the central supported-games config (active) PLUS any legacy
  // titles still referenced by demo data (lol, nba2k), which we seed INACTIVE
  // so historical competitions/teams keep resolving but the titles are hidden
  // from every dropdown and blocked from new creation.
  type GameSeed = { slug: string; name: string; publisher: string; formats: string[]; active: boolean };
  const gameSeeds: GameSeed[] = [
    ...SUPPORTED_GAMES.map((g) => ({
      slug: g.slug,
      name: g.name,
      publisher: g.publisher,
      formats: g.formats,
      active: true,
    })),
    ...PLATFORM_GAMES.filter((p) => !isSupportedGame(p.id)).map((p) => ({
      slug: p.id,
      name: p.name,
      publisher: p.publisher,
      formats: p.formats,
      active: false, // deprecated — preserved for demo continuity, not selectable
    })),
  ];

  for (const g of gameSeeds) {
    const game = await prisma.gameTitle.upsert({
      where: { slug: g.slug },
      update: { name: g.name, publisher: g.publisher, active: g.active },
      create: { name: g.name, slug: g.slug, publisher: g.publisher, active: g.active },
    });
    gameMap.set(g.slug, game.id);

    for (const fmt of g.formats) {
      const f = await prisma.gameFormat.upsert({
        where: { gameTitleId_name: { gameTitleId: game.id, name: fmt } },
        update: {},
        create: {
          gameTitleId: game.id,
          name: fmt,
          playerCount: FORMAT_PLAYER_COUNT[fmt] ?? 5,
        },
      });
      formatMap.set(`${g.slug}:${fmt}`, f.id);
    }
  }
  const activeGames = gameSeeds.filter((g) => g.active).length;
  console.log(`  → ${gameMap.size} games (${activeGames} active), ${formatMap.size} formats`);

  // ============================================================
  // 2. Leagues
  // ============================================================
  console.log("[2/10] Leagues");
  const leagueMap = new Map<string, string>();
  for (const l of PLATFORM_LEAGUES) {
    const league = await prisma.league.upsert({
      where: { slug: l.slug },
      update: {
        name: l.name,
        description: l.description,
        primaryColor: l.primaryColor,
        classification: l.classification,
      },
      create: {
        name: l.name,
        slug: l.slug,
        description: l.description,
        primaryColor: l.primaryColor,
        classification: l.classification,
      },
    });
    leagueMap.set(l.id, league.id);
  }
  console.log(`  → ${leagueMap.size} leagues`);

  // ============================================================
  // 3. Users — derive from PLATFORM_ADMINS + RIEL_STAFF + COACHES
  // ============================================================
  console.log("[3/10] Users");
  const userMap = new Map<string, string>(); // email → real id

  async function ensureUser(email: string, name: string) {
    const lower = email.toLowerCase();
    if (userMap.has(lower)) return userMap.get(lower)!;
    const u = await prisma.user.upsert({
      where: { email: lower },
      update: { fullName: name },
      create: {
        email: lower,
        fullName: name,
        // Placeholder authId — real Supabase auth.users.id will replace this
        // when the user signs in for the first time. Bridge logic compares emails.
        authId: `seed:${lower}`,
      },
    });
    userMap.set(lower, u.id);
    return u.id;
  }

  for (const a of PLATFORM_ADMINS) await ensureUser(a.email, a.name);
  for (const s of RIEL_STAFF) await ensureUser(s.email, s.name);
  for (const c of Object.values(COACHES)) await ensureUser(c.email, c.name);
  console.log(`  → ${userMap.size} users`);

  // ============================================================
  // 4. Schools
  // ============================================================
  console.log("[4/10] Schools");
  const schoolMap = new Map<string, string>(); // ps-mchs → real id
  const schoolByCode = new Map<string, string>(); // "MCH" → real id (for matching legacy data)

  for (const s of PLATFORM_SCHOOLS) {
    const school = await prisma.school.upsert({
      where: s.ncesId ? { ncesId: s.ncesId } : { id: s.id },
      update: {
        name: s.name,
        shortName: s.shortName,
        code: s.code,
        city: s.city,
        state: s.state,
        primaryColor: s.primaryColor,
      },
      create: {
        name: s.name,
        shortName: s.shortName,
        code: s.code,
        city: s.city,
        state: s.state,
        primaryColor: s.primaryColor,
        ncesId: s.ncesId,
      },
    });
    schoolMap.set(s.id, school.id);
    if (s.code) schoolByCode.set(s.code.toUpperCase(), school.id);
  }
  console.log(`  → ${schoolMap.size} schools`);

  // ============================================================
  // 5. League adminships (PLATFORM_ADMINS → LeagueAdminship)
  // ============================================================
  console.log("[5/10] League adminships");
  let adminshipsCount = 0;
  for (const admin of PLATFORM_ADMINS) {
    const userId = userMap.get(admin.email.toLowerCase())!;
    for (const lgId of admin.leagueIds) {
      const leagueId = leagueMap.get(lgId);
      if (!leagueId) continue;
      await prisma.leagueAdminship.upsert({
        where: { leagueId_userId: { leagueId, userId } },
        update: { role: roleFor(admin) },
        create: { leagueId, userId, role: roleFor(admin) },
      });
      adminshipsCount += 1;
    }
  }
  console.log(`  → ${adminshipsCount} league adminships`);

  // ============================================================
  // 6. League memberships (school → league)
  // ============================================================
  console.log("[6/10] League memberships");
  let membershipsCount = 0;
  for (const s of PLATFORM_SCHOOLS) {
    const schoolId = schoolMap.get(s.id)!;
    for (const lgId of s.leagueIds) {
      const leagueId = leagueMap.get(lgId);
      if (!leagueId) continue;
      await prisma.leagueMembership.upsert({
        where: { leagueId_schoolId: { leagueId, schoolId } },
        update: { status: s.status === "PENDING" ? "PENDING" : "ACTIVE" },
        create: {
          leagueId,
          schoolId,
          status: s.status === "PENDING" ? "PENDING" : "ACTIVE",
        },
      });
      membershipsCount += 1;
    }
  }
  console.log(`  → ${membershipsCount} league memberships`);

  // ============================================================
  // 7. School memberships — link school owner as MANAGER + isOwner
  // ============================================================
  console.log("[7/10] School memberships (owners)");
  let schoolMembershipCount = 0;
  for (const s of PLATFORM_SCHOOLS) {
    if (!s.ownerEmail) continue;
    const userId = userMap.get(s.ownerEmail.toLowerCase());
    const schoolId = schoolMap.get(s.id);
    if (!userId || !schoolId) continue;

    await prisma.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId, userId } },
      update: { role: "MANAGER", isOwner: true },
      create: { schoolId, userId, role: "MANAGER", isOwner: true },
    });
    schoolMembershipCount += 1;
  }
  console.log(`  → ${schoolMembershipCount} school memberships`);

  // ============================================================
  // 8. Teams
  //
  // The mock TEAMS use legacy "s1"-"s8" school IDs. Map those to real schools
  // via the canonical short code (CAR, FHS, etc.) by looking up the legacy
  // school's `code` field in lib/mock/data.SCHOOLS — but that file doesn't
  // export school code / id mapping cleanly. We'll cheat: hardcoded mapping.
  // ============================================================
  console.log("[8/10] Teams");
  const LEGACY_SCHOOL_CODE: Record<string, string> = {
    s1: "CAR",
    s2: "FHS",
    s3: "HSE",
    s4: "NCH",
    s5: "CGV",
    s6: "BRE",
    s7: "CTH",
    s8: "LWC",
  };

  const GAME_NAME_TO_ID: Record<string, string> = {
    "League of Legends": "lol",
    Valorant: "val",
    "Rocket League": "rl",
    "Overwatch 2": "ow2",
    "Super Smash Bros.": "smash",
  };

  const TIER_MAP: Record<string, "VARSITY" | "JV" | "UNIFIED" | "CLUB"> = {
    Varsity: "VARSITY",
    JV: "JV",
    Unified: "UNIFIED",
    Club: "CLUB",
  };

  const teamMap = new Map<string, string>(); // legacy team id (t1, t2…) → real id
  let teamCount = 0;
  for (const t of TEAMS) {
    const code = LEGACY_SCHOOL_CODE[t.schoolId];
    const schoolId = code ? schoolByCode.get(code) : undefined;
    const gameMockId = GAME_NAME_TO_ID[t.game];
    const gameTitleId = gameMockId ? gameMap.get(gameMockId) : undefined;
    if (!schoolId || !gameTitleId) {
      console.warn(`  ! Skipping team ${t.id} (${t.name}) — missing school or game`);
      continue;
    }

    // Find first format for the game
    const formats = await prisma.gameFormat.findMany({ where: { gameTitleId }, take: 1 });
    const gameFormatId = formats[0]?.id;

    const team = await prisma.team.upsert({
      where: { id: `seed-team-${t.id}` },
      update: {
        skillTier: TIER_MAP[t.tier] ?? "VARSITY",
        customName: t.name,
      },
      create: {
        id: `seed-team-${t.id}`,
        schoolId,
        gameTitleId,
        gameFormatId,
        skillTier: TIER_MAP[t.tier] ?? "VARSITY",
        customName: t.name,
      },
    });
    teamMap.set(t.id, team.id);
    teamCount += 1;
  }
  console.log(`  → ${teamCount} teams`);

  // ============================================================
  // 9. Seasons + Competitions + Stages + Rosters + Matches
  // ============================================================
  console.log("[9/10] Seasons / Competitions / Matches");

  // One Spring 2026 season per active league
  const seasonMap = new Map<string, string>(); // leagueId → seasonId
  for (const l of PLATFORM_LEAGUES.filter((l) => l.status === "ACTIVE" || l.status === "TRIAL")) {
    const leagueId = leagueMap.get(l.id)!;
    const existing = await prisma.season.findFirst({
      where: { leagueId, name: "Spring 2026" },
    });
    const season =
      existing ??
      (await prisma.season.create({
        data: {
          leagueId,
          name: "Spring 2026",
          startsAt: new Date("2026-01-15"),
          endsAt: new Date("2026-05-30"),
        },
      }));
    seasonMap.set(l.id, season.id);
  }

  // Competitions for the RIEL league only (5 active competitions)
  const rielSeasonId = seasonMap.get("lg-riel")!;
  const competitionByGame = new Map<string, { id: string; stageId: string }>();

  type CompSeed = { name: string; gameMockId: string; tier: "VARSITY" | "JV" | "UNIFIED" };
  const COMP_SEEDS: CompSeed[] = [
    { name: "Spring 2026 — League of Legends Varsity", gameMockId: "lol", tier: "VARSITY" },
    { name: "Spring 2026 — Valorant Varsity", gameMockId: "val", tier: "VARSITY" },
    { name: "Spring 2026 — Rocket League Varsity", gameMockId: "rl", tier: "VARSITY" },
    { name: "Spring 2026 — Super Smash Bros. Unified", gameMockId: "smash", tier: "UNIFIED" },
    { name: "Spring 2026 — Overwatch 2 Varsity", gameMockId: "ow2", tier: "VARSITY" },
  ];

  for (const c of COMP_SEEDS) {
    const gameTitleId = gameMap.get(c.gameMockId)!;
    const formatId = (await prisma.gameFormat.findFirst({ where: { gameTitleId } }))?.id;

    const competition = await prisma.competition.upsert({
      where: { id: `seed-comp-${c.gameMockId}-${c.tier}` },
      update: { name: c.name },
      create: {
        id: `seed-comp-${c.gameMockId}-${c.tier}`,
        seasonId: rielSeasonId,
        name: c.name,
        gameTitleId,
        gameFormatId: formatId,
        skillTier: c.tier,
        kind: "SEASON_PLAY",
        state: "ACTIVE",
        status: "IN_PROGRESS",
      },
    });

    // One Stage per competition (League Play)
    const stage = await prisma.stage.upsert({
      where: { id: `seed-stage-${c.gameMockId}-${c.tier}` },
      update: {},
      create: {
        id: `seed-stage-${c.gameMockId}-${c.tier}`,
        competitionId: competition.id,
        name: "League Play",
        kind: "ROUND_ROBIN",
        schedulingMethod: "ROUND_ROBIN",
        order: 0,
        state: "ACTIVE",
        status: "IN_PROGRESS",
        startsAt: new Date("2026-01-15"),
        endsAt: new Date("2026-04-30"),
        bestOf: 3,
        gamesPerMatch: 3,
      },
    });

    competitionByGame.set(c.gameMockId, { id: competition.id, stageId: stage.id });
  }

  // Rosters — every team gets a Roster in its game's competition
  const rosterMap = new Map<string, string>(); // legacy team id → roster id
  for (const t of TEAMS) {
    const teamRealId = teamMap.get(t.id);
    if (!teamRealId) continue;
    const gameMockId = GAME_NAME_TO_ID[t.game];
    if (!gameMockId) continue;
    const comp = competitionByGame.get(gameMockId);
    if (!comp) continue;

    const roster = await prisma.roster.upsert({
      where: { teamId_competitionId: { teamId: teamRealId, competitionId: comp.id } },
      update: {},
      create: {
        teamId: teamRealId,
        competitionId: comp.id,
        registrationStatus: "APPROVED",
      },
    });
    rosterMap.set(t.id, roster.id);
  }

  // Matches — link via team→roster
  let matchCount = 0;
  for (const m of MATCHES) {
    const homeRosterId = rosterMap.get(m.homeTeamId);
    const awayRosterId = rosterMap.get(m.awayTeamId);
    if (!homeRosterId || !awayRosterId) continue;

    const gameMockId = GAME_NAME_TO_ID[m.game];
    const comp = gameMockId ? competitionByGame.get(gameMockId) : undefined;
    if (!comp) continue;

    // Map mock statuses (from lib/mock/data) to Prisma MatchStatus enum
    const status =
      m.status === "LIVE"
        ? "IN_PROGRESS"
        : m.status === "AWAITING_REPORT"
          ? "AWAITING_CONFIRMATION"
          : m.status === "CONFIRMED"
            ? "FINISHED"
            : m.status;

    await prisma.match.upsert({
      where: { id: `seed-match-${m.id}` },
      update: {
        // Refresh on every reseed — `m.scheduledAt` is computed relative to
        // today via `at()` in lib/mock/data, so future-dated matches stay
        // future-dated even after the original seed run ages out.
        scheduledAt: m.scheduledAt,
        status: status as never,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      },
      create: {
        id: `seed-match-${m.id}`,
        stageId: comp.stageId,
        homeRosterId,
        awayRosterId,
        scheduledAt: m.scheduledAt,
        status: status as never,
        bestOf: 3,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      },
    });
    matchCount += 1;
  }
  console.log(
    `  → ${seasonMap.size} seasons, ${competitionByGame.size} competitions, ${rosterMap.size} rosters, ${matchCount} matches`,
  );

  // ============================================================
  // 9b. Synthetic historical matches (Board Dashboard data)
  // ============================================================
  // Generates ~120 finished matches over the last 60 days with a realistic
  // ~13% forfeit rate. Three "repeat offender" rosters get +20% forfeit
  // weight so the "Top FF teams" leaderboard has meaningful variation.
  // All deterministic via mulberry32 RNG → reseeds produce identical data.
  console.log("[9b/10] Synthetic historical matches");

  const rostersByComp = new Map<string, string[]>();
  for (const [, comp] of competitionByGame) {
    const rosters = await prisma.roster.findMany({
      where: { competitionId: comp.id },
      select: { id: true },
    });
    rostersByComp.set(comp.id, rosters.map((r) => r.id));
  }

  const rng = makeRng("riel-board-dashboard-v1");

  // Weighted distribution of forfeit reasons. Numbers reflect realistic
  // scholastic-esports patterns (most forfeits are no-show or schedule
  // conflict; technical / illness are rarer; OTHER is the catch-all).
  type ForfeitReasonValue =
    | "OPPONENT_NO_SHOW"
    | "SCHEDULING_CONFLICT"
    | "INSUFFICIENT_ROSTER"
    | "TECHNICAL_ISSUES"
    | "PLAYER_ILLNESS"
    | "ELIGIBILITY_ISSUE"
    | "WEATHER_TRAVEL"
    | "OPPONENT_CONDUCT"
    | "OTHER";

  const REASON_WEIGHTS: Array<{ kind: ForfeitReasonValue; weight: number; sampleNote?: string }> = [
    { kind: "OPPONENT_NO_SHOW", weight: 30 },
    { kind: "SCHEDULING_CONFLICT", weight: 22 },
    { kind: "INSUFFICIENT_ROSTER", weight: 15 },
    { kind: "TECHNICAL_ISSUES", weight: 10 },
    { kind: "PLAYER_ILLNESS", weight: 8 },
    { kind: "WEATHER_TRAVEL", weight: 6 },
    { kind: "ELIGIBILITY_ISSUE", weight: 4 },
    { kind: "OPPONENT_CONDUCT", weight: 3 },
    {
      kind: "OTHER",
      weight: 2,
      sampleNote: "Coach pulled team after disciplinary review.",
    },
  ];
  const REASON_TOTAL = REASON_WEIGHTS.reduce((s, r) => s + r.weight, 0);

  function pickReason(): { kind: ForfeitReasonValue; note: string | null } {
    let pick = rng() * REASON_TOTAL;
    for (const r of REASON_WEIGHTS) {
      pick -= r.weight;
      if (pick <= 0) return { kind: r.kind, note: r.sampleNote ?? null };
    }
    return { kind: "OTHER", note: "Unspecified." };
  }

  // Whether the coach attempted to reschedule before forfeiting. Reasonable
  // teams almost always try; OPPONENT_NO_SHOW and OPPONENT_CONDUCT skew lower
  // because the issue is on the other side.
  function pickRescheduleAttempted(reason: ForfeitReasonValue): boolean {
    if (reason === "OPPONENT_NO_SHOW") return rng() < 0.4;
    if (reason === "OPPONENT_CONDUCT") return rng() < 0.3;
    if (reason === "WEATHER_TRAVEL") return rng() < 0.85;
    if (reason === "PLAYER_ILLNESS") return rng() < 0.75;
    return rng() < 0.7;
  }

  // Pick 3 repeat-offender rosters from the full pool
  const allRosterIds = Array.from(rostersByComp.values()).flat();
  const repeatOffenders = new Set<string>();
  while (repeatOffenders.size < 3 && repeatOffenders.size < allRosterIds.length) {
    repeatOffenders.add(allRosterIds[Math.floor(rng() * allRosterIds.length)]);
  }

  let synthCount = 0;
  let synthForfeits = 0;
  const now = new Date();

  for (const [compMockId, comp] of competitionByGame) {
    const rosters = rostersByComp.get(comp.id) ?? [];
    if (rosters.length < 2) continue;

    const matchesThisComp = 24; // ~120 total / 5 comps
    for (let i = 0; i < matchesThisComp; i++) {
      // Pick two distinct rosters
      const homeIdx = Math.floor(rng() * rosters.length);
      let awayIdx = Math.floor(rng() * rosters.length);
      if (awayIdx === homeIdx) awayIdx = (awayIdx + 1) % rosters.length;
      const homeRosterId = rosters[homeIdx];
      const awayRosterId = rosters[awayIdx];

      // Date in the last 60 days at 16:00–20:00 local
      const daysAgo = Math.floor(rng() * 60);
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() - daysAgo);
      scheduledAt.setHours(16 + Math.floor(rng() * 5), 0, 0, 0);

      // Forfeit probability — base 13%, +20% if either team is a repeat offender
      let isForfeit = rng() < 0.13;
      const homeOffender = repeatOffenders.has(homeRosterId);
      const awayOffender = repeatOffenders.has(awayRosterId);
      if (!isForfeit && (homeOffender || awayOffender) && rng() < 0.2) {
        isForfeit = true;
      }

      let status: "FINISHED" | "FORFEITED";
      let forfeitingSide: "HOME" | "AWAY" | null = null;
      let homeScore: number | null;
      let awayScore: number | null;
      let winnerRosterId: string | null;
      let forfeitReason: ForfeitReasonValue | null = null;
      let forfeitNotes: string | null = null;
      let rescheduleAttempted: boolean | null = null;
      let forfeitedAt: Date | null = null;

      if (isForfeit) {
        synthForfeits += 1;
        // Choose forfeiter — strongly bias toward the repeat offender
        let forfeiter: "HOME" | "AWAY";
        if (homeOffender && !awayOffender) forfeiter = "HOME";
        else if (awayOffender && !homeOffender) forfeiter = "AWAY";
        else forfeiter = rng() < 0.5 ? "HOME" : "AWAY";

        forfeitingSide = forfeiter;
        const reasonPick = pickReason();
        forfeitReason = reasonPick.kind;
        forfeitNotes = reasonPick.note;
        rescheduleAttempted = pickRescheduleAttempted(reasonPick.kind);
        forfeitedAt = new Date(scheduledAt.getTime() + 30 * 60 * 1000);

        // 30% whole-match forfeit (no games played), 70% rage-quit mid-Bo3
        if (rng() < 0.3) {
          status = "FORFEITED";
          homeScore = null;
          awayScore = null;
        } else {
          status = "FINISHED";
          const wonOneGame = rng() < 0.4;
          if (forfeiter === "HOME") {
            homeScore = wonOneGame ? 1 : 0;
            awayScore = 2;
          } else {
            homeScore = 2;
            awayScore = wonOneGame ? 1 : 0;
          }
        }
        winnerRosterId = forfeiter === "HOME" ? awayRosterId : homeRosterId;
      } else {
        status = "FINISHED";
        // Normal finish: 60% sweep (2-0), 40% close (2-1)
        const close = rng() < 0.4;
        const homeWins = rng() < 0.5;
        if (homeWins) {
          homeScore = 2;
          awayScore = close ? 1 : 0;
          winnerRosterId = homeRosterId;
        } else {
          homeScore = close ? 1 : 0;
          awayScore = 2;
          winnerRosterId = awayRosterId;
        }
      }

      const synthId = `seed-synth-match-${compMockId}-${i}`;
      const finishedAt = new Date(scheduledAt.getTime() + 90 * 60 * 1000); // ~90 min play

      await prisma.match.upsert({
        where: { id: synthId },
        update: {
          status,
          isForfeit,
          forfeitingSide,
          forfeitReason,
          forfeitNotes,
          rescheduleAttempted,
          forfeitedAt,
          homeScore,
          awayScore,
          winnerRosterId,
          finishedAt,
        },
        create: {
          id: synthId,
          stageId: comp.stageId,
          homeRosterId,
          awayRosterId,
          scheduledAt,
          status,
          isForfeit,
          forfeitingSide,
          forfeitReason,
          forfeitNotes,
          rescheduleAttempted,
          forfeitedAt,
          bestOf: 3,
          homeScore,
          awayScore,
          winnerRosterId,
          finishedAt,
        },
      });
      synthCount += 1;
    }
  }

  const ffRate = synthCount > 0 ? ((synthForfeits / synthCount) * 100).toFixed(1) : "0.0";
  console.log(
    `  → ${synthCount} synthetic matches, ${synthForfeits} forfeits (${ffRate}% rate), ${repeatOffenders.size} repeat offenders`,
  );

  // ============================================================
  // 9c. Players, RosterMemberships, Goals, sample coach comments
  // ============================================================
  // For each team's roster: create 4 player users with deterministic emails
  // (so reseeds are idempotent), bind them via RosterMembership, give each a
  // sample PlayerGoal, and a 1-line coach comment from their school's coach.
  // Real PlayerComments and goals come later via slice 4 mutations.
  console.log("[9c/10] Players, memberships, goals, comments");

  const PLAYER_NAMES = [
    "Aiden Chen", "Maya Rodriguez", "Jordan Lee", "Sofia Patel", "Ethan Brooks",
    "Zara Williams", "Marcus Kim", "Olivia Garcia", "Tyler Nguyen", "Aaliyah Davis",
    "Noah Singh", "Camille Foster", "Diego Martinez", "Riya Sharma", "Lucas Bennett",
    "Emma Thompson", "Carlos Vega", "Ava Mitchell", "Kenji Tanaka", "Amara Johnson",
    "Felix Park", "Isabella Cruz", "Owen Walsh", "Priya Iyer", "Theo Müller",
    "Harper Reyes", "Sebastian Cole", "Aarav Gupta", "Maddie O'Brien", "Kai Yamamoto",
    "Lily Hayes", "Jaxon Reed", "Anika Joshi", "Caleb Brooks", "Mira Sato",
    "Devon Clarke", "Selena Vargas", "Ryan O'Connor", "Hana Choi", "Bryce Tanner",
    "Zoe Kapoor", "Mateo Flores", "Eva Larsson", "Nathan Wu", "Brielle Anderson",
    "Tariq Ahmed", "Iris Blackwood", "Quentin Hayes", "Naomi Patel", "Jasper Cole",
    "Vera Kowalski", "Andre Beck", "Sienna Holt", "Jonah Sterling", "Lana Petrov",
    "Mason Greer", "Talia Suzuki", "Wesley Tran", "Ophelia Diaz", "Cyrus Bell",
    "Amelia Ford", "Reza Karimi", "Daphne Wells", "Levi Gomez", "Skye Anderson",
  ];

  const IGN_BANK = ["nyx", "ace", "spark", "rift", "vapor", "echo", "swift", "neon", "frost", "blaze", "vortex", "drift", "pulse", "ghost", "warden", "raven"];

  const GOAL_TEMPLATES: Array<{
    kind: "WINS" | "WIN_RATE" | "ATTENDANCE_RATE" | "MATCHES_PLAYED";
    targetValue: number;
    label: string;
  }> = [
    { kind: "WINS", targetValue: 5, label: "5 wins this season" },
    { kind: "WIN_RATE", targetValue: 60, label: "60% win rate over last 10" },
    { kind: "ATTENDANCE_RATE", targetValue: 100, label: "Perfect attendance" },
    { kind: "MATCHES_PLAYED", targetValue: 8, label: "Play 8 matches" },
  ];

  const COMMENT_TEMPLATES = [
    "Great calls in the late game last week — keep that energy going.",
    "Watch your positioning on map control. We'll drill it at Tuesday's practice.",
    "Solid attendance and communication this month. Captain material.",
    "Welcome to the squad. Excited to see what you can do this season.",
  ];

  let playerCount = 0;
  let goalCount = 0;
  let commentCount = 0;

  for (const t of TEAMS) {
    const teamRealId = teamMap.get(t.id);
    if (!teamRealId) continue;
    const rosterId = rosterMap.get(t.id);
    if (!rosterId) continue;

    // Resolve the team's school's coach (if any) to author sample comments.
    const coach = COACHES[t.schoolId];
    const coachUserId = coach ? userMap.get(coach.email.toLowerCase()) : null;

    // Find a school domain for this team for emails (use shortName if present).
    const school = await prisma.school.findUnique({
      where: { id: (await prisma.team.findUnique({ where: { id: teamRealId }, select: { schoolId: true } }))!.schoolId },
      select: { shortName: true, name: true },
    });
    const schoolSlug = (school?.shortName ?? school?.name ?? "school")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12);

    for (let i = 0; i < 4; i++) {
      // Deterministic name from a hash of (mockTeamId + index)
      const hashSrc = `${t.id}-${i}`;
      let h = 0;
      for (let c = 0; c < hashSrc.length; c++) {
        h = (h * 31 + hashSrc.charCodeAt(c)) >>> 0;
      }
      const name = PLAYER_NAMES[h % PLAYER_NAMES.length];
      const ign = IGN_BANK[(h >>> 4) % IGN_BANK.length] + (i + 1);
      const [first, last] = name.toLowerCase().split(/\s+/);
      const emailLocal = `${first}.${last ?? "p"}.${t.id}-${i}`.replace(/[^a-z0-9.\-]/g, "");
      const email = `${emailLocal}@${schoolSlug}.dev.riel.gg`;

      // Upsert the User (idempotent on email)
      const player = await prisma.user.upsert({
        where: { email },
        update: { fullName: name },
        create: {
          email,
          fullName: name,
          authId: `seed-player:${email}`, // placeholder; real authId set on first sign-in
        },
      });
      userMap.set(email, player.id);

      // Upsert RosterMembership (idempotent on rosterId+userId)
      await prisma.rosterMembership.upsert({
        where: { rosterId_userId: { rosterId, userId: player.id } },
        update: {},
        create: {
          rosterId,
          userId: player.id,
          role: i === 0 ? "CAPTAIN" : "PLAYER",
          jerseyNumber: i + 1,
          inGameName: ign,
        },
      });

      // Sample PlayerGoal (rotate through templates) — use deterministic ID for
      // idempotency.
      const goal = GOAL_TEMPLATES[i % GOAL_TEMPLATES.length];
      await prisma.playerGoal.upsert({
        where: { id: `seed-goal-${player.id}-${i}` },
        update: {},
        create: {
          id: `seed-goal-${player.id}-${i}`,
          playerId: player.id,
          kind: goal.kind,
          targetValue: goal.targetValue,
          label: goal.label,
        },
      });
      goalCount += 1;

      // Sample coach comment (only if we have a coach for this school)
      if (coachUserId) {
        const commentBody = COMMENT_TEMPLATES[i % COMMENT_TEMPLATES.length];
        await prisma.playerComment.upsert({
          where: { id: `seed-comment-${player.id}-${i}` },
          update: {},
          create: {
            id: `seed-comment-${player.id}-${i}`,
            playerId: player.id,
            authorId: coachUserId,
            kind: "COACH",
            visibility: "PRIVATE",
            body: commentBody,
          },
        });
        commentCount += 1;
      }

      playerCount += 1;
    }
  }

  console.log(`  → ${playerCount} players, ${goalCount} goals, ${commentCount} coach comments`);

  // ============================================================
  // 10. Match-related: messages, reports, announcements, audit log
  // ============================================================
  console.log("[10/10] Messages, reports, announcements, audit");

  let msgCount = 0;
  for (const msg of MATCH_MESSAGES) {
    const matchRealId = `seed-match-${msg.matchId}`;
    const author = msg.authorSchoolId === "system" ? null : COACHES[msg.authorSchoolId];
    const authorUserId = author ? userMap.get(author.email.toLowerCase()) : null;
    try {
      await prisma.matchMessage.upsert({
        where: { id: `seed-msg-${msg.id}` },
        update: {},
        create: {
          id: `seed-msg-${msg.id}`,
          matchId: matchRealId,
          authorUserId: authorUserId ?? null,
          kind: msg.kind === "system" ? "SYSTEM" : msg.kind === "evidence" ? "EVIDENCE" : "TEXT",
          body: msg.body,
          attachmentPath: msg.attachment ?? null,
        },
      });
      msgCount += 1;
    } catch {
      // Match doesn't exist (e.g., m4 wasn't seeded) — skip silently
    }
  }

  // Match reports — pick the roster owned by the reporting coach's school
  let reportCount = 0;
  for (const r of MATCH_REPORTS) {
    const matchRealId = `seed-match-${r.matchId}`;
    const coach = COACHES[r.reportedByCoachSchoolId];
    if (!coach) continue;
    const reportedByUserId = userMap.get(coach.email.toLowerCase());
    if (!reportedByUserId) continue;

    const match = await prisma.match.findUnique({
      where: { id: matchRealId },
      include: {
        homeRoster: { include: { team: true } },
        awayRoster: { include: { team: true } },
      },
    });
    if (!match) continue;

    // Find which side belongs to the coach's school
    const coachLegacySchool = r.reportedByCoachSchoolId; // s1, s2…
    const coachCode = LEGACY_SCHOOL_CODE[coachLegacySchool];
    const coachSchoolId = coachCode ? schoolByCode.get(coachCode) : undefined;
    if (!coachSchoolId) continue;

    const myRosterId =
      match.homeRoster.team.schoolId === coachSchoolId
        ? match.homeRosterId
        : match.awayRoster.team.schoolId === coachSchoolId
          ? match.awayRosterId
          : match.homeRosterId; // fallback

    // Ensure the coach has a RosterMembership on that roster
    let rosterMembership = await prisma.rosterMembership.findFirst({
      where: { rosterId: myRosterId, userId: reportedByUserId },
    });
    if (!rosterMembership) {
      rosterMembership = await prisma.rosterMembership.create({
        data: { rosterId: myRosterId, userId: reportedByUserId, role: "COACH" },
      });
    }

    // Idempotent: skip if already created (we don't have a unique key, so just check)
    const existing = await prisma.matchReport.findFirst({
      where: { matchId: matchRealId, reportedByUserId },
    });
    if (existing) continue;

    await prisma.matchReport.create({
      data: {
        matchId: matchRealId,
        reportedByMembershipId: rosterMembership.id,
        reportedByUserId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        notes: r.notes,
      },
    });
    reportCount += 1;
  }

  // Announcements — scope to RIEL league
  let announcementCount = 0;
  const rielLeagueId = leagueMap.get("lg-riel")!;
  const carlos = userMap.get("cmelendez@riel.gg");
  if (carlos) {
    for (const a of ANNOUNCEMENTS) {
      await prisma.announcement.upsert({
        where: { id: `seed-announcement-${a.id}` },
        update: { title: a.title, body: a.body, pinned: a.pinned ?? false },
        create: {
          id: `seed-announcement-${a.id}`,
          scope: "LEAGUE",
          scopeRefId: rielLeagueId,
          leagueId: rielLeagueId,
          authorId: carlos,
          title: a.title,
          body: a.body,
          pinned: a.pinned ?? false,
        },
      });
      announcementCount += 1;
    }
  }

  // Audit log
  let auditCount = 0;
  for (const ev of AUDIT_EVENTS) {
    const actorEmail = ev.actorEmail?.toLowerCase();
    const actorUserId = actorEmail ? userMap.get(actorEmail) ?? null : null;
    const leagueRealId = ev.leagueId ? leagueMap.get(ev.leagueId) ?? null : null;
    await prisma.auditLog.upsert({
      where: { id: `seed-audit-${ev.id}` },
      update: {},
      create: {
        id: `seed-audit-${ev.id}`,
        actorUserId: actorUserId ?? undefined,
        action: ev.action,
        entityType: ev.action.split(".")[0],
        entityId: leagueRealId ?? "platform",
        leagueId: leagueRealId,
      },
    });
    auditCount += 1;
  }

  // Platform activity (seeded as audit-style entries too)
  for (const a of PLATFORM_ACTIVITY) {
    const leagueRealId = a.leagueId ? leagueMap.get(a.leagueId) ?? null : null;
    await prisma.auditLog.upsert({
      where: { id: `seed-platform-activity-${a.id}` },
      update: {},
      create: {
        id: `seed-platform-activity-${a.id}`,
        action: `PLATFORM.${a.kind.toUpperCase()}`,
        entityType: "PlatformEvent",
        entityId: leagueRealId ?? "platform",
        leagueId: leagueRealId,
        metadata: { actor: a.actor, body: a.body, ago: a.ago },
      },
    });
    auditCount += 1;
  }

  console.log(
    `  → ${msgCount} messages, ${reportCount} reports, ${announcementCount} announcements, ${auditCount} audit entries`,
  );

  // ============================================================
  // Done
  // ============================================================
  console.log("\n=== Seed complete ===\n");

  // Final counts
  const counts = {
    leagues: await prisma.league.count(),
    schools: await prisma.school.count(),
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    seasons: await prisma.season.count(),
    competitions: await prisma.competition.count(),
    stages: await prisma.stage.count(),
    rosters: await prisma.roster.count(),
    matches: await prisma.match.count(),
    matchMessages: await prisma.matchMessage.count(),
    matchReports: await prisma.matchReport.count(),
    announcements: await prisma.announcement.count(),
    auditLogs: await prisma.auditLog.count(),
    rosterMemberships: await prisma.rosterMembership.count(),
    playerGoals: await prisma.playerGoal.count(),
    playerComments: await prisma.playerComment.count(),
  };
  console.table(counts);
}

function roleFor(admin: PlatformAdmin): "OWNER" | "ADMIN" | "STAFF" {
  return admin.role === "OWNER" ? "OWNER" : admin.role === "ADMIN" ? "ADMIN" : "STAFF";
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("\n!!! Seed failed:");
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
