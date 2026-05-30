/**
 * Seed-source mock data.
 *
 * Despite living under `lib/mock/`, this file is now ONLY consumed by:
 *   - `prisma/seed.ts` (turns these arrays into real Postgres rows)
 *   - `lib/mock/admin.ts` (re-exports a few constants and the `GameTitle` type)
 *
 * No UI surface reads from here directly anymore — every `/dashboard/*`,
 * `/admin/*`, `/me`, and `/league/*` page now reads from Prisma. Treat this
 * file as the authoritative seed input; edit it when you want new seeded
 * data, then run `npm run db:seed`.
 */

// --- Types --------------------------------------------------------------

export type GameTitle =
  | "League of Legends"
  | "Valorant"
  | "Rocket League"
  | "Super Smash Bros."
  | "Overwatch 2";

export type Tier = "Varsity" | "JV" | "Unified";

export type School = {
  id: string;
  code: string;
  name: string;
  short: string;
  color: string;
};

export type Team = {
  id: string;
  schoolId: string;
  name: string;
  game: GameTitle;
  tier: Tier;
  wins: number;
  losses: number;
  streak: number;
};

export type MatchStatus = "SCHEDULED" | "LIVE" | "AWAITING_REPORT" | "CONFIRMED";

export type Match = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  game: GameTitle;
  scheduledAt: Date;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  isUnified?: boolean;
};

export type Coach = {
  schoolId: string;
  name: string;
  initials: string;
  email: string;
};

export type MessageKind = "text" | "system" | "evidence";

export type MatchMessage = {
  id: string;
  matchId: string;
  authorSchoolId: string;
  body: string;
  ago: string;
  kind: MessageKind;
  attachment?: string;
};

export type MatchReport = {
  id: string;
  matchId: string;
  reportedByCoachSchoolId: string;
  homeScore: number;
  awayScore: number;
  evidenceUrls: string[];
  notes: string;
  submittedAgo: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned?: boolean;
  audience: "League" | "Division" | "School";
  postedAt: string;
};

// --- Schools ------------------------------------------------------------

export const SCHOOLS: School[] = [
  { id: "s1", code: "CAR", name: "Carmel High School", short: "Carmel", color: "#1f3a8a" },
  { id: "s2", code: "FHS", name: "Fishers High School", short: "Fishers", color: "#7c2d12" },
  { id: "s3", code: "HSE", name: "Hamilton Southeastern", short: "HSE", color: "#365314" },
  { id: "s4", code: "NCH", name: "North Central HS", short: "North Central", color: "#831843" },
  { id: "s5", code: "CGV", name: "Center Grove HS", short: "Center Grove", color: "#581c87" },
  { id: "s6", code: "BRE", name: "Brebeuf Jesuit", short: "Brebeuf", color: "#0c4a6e" },
  { id: "s7", code: "CTH", name: "Cathedral HS", short: "Cathedral", color: "#78350f" },
  { id: "s8", code: "LWC", name: "Lawrence Central", short: "Lawrence Central", color: "#134e4a" },
];

export const ME_SCHOOL_ID = "s1";

// --- Teams --------------------------------------------------------------

export const TEAMS: Team[] = [
  { id: "t1", schoolId: "s1", name: "Carmel Greyhounds — LoL", game: "League of Legends", tier: "Varsity", wins: 8, losses: 2, streak: 4 },
  { id: "t2", schoolId: "s1", name: "Carmel Greyhounds — RL", game: "Rocket League", tier: "Varsity", wins: 6, losses: 4, streak: 1 },
  { id: "t3", schoolId: "s1", name: "Carmel Greyhounds — VAL", game: "Valorant", tier: "Varsity", wins: 5, losses: 5, streak: -2 },
  { id: "t4", schoolId: "s1", name: "Carmel Unified — Smash", game: "Super Smash Bros.", tier: "Unified", wins: 7, losses: 1, streak: 5 },
  { id: "t5", schoolId: "s2", name: "Fishers Tigers — LoL", game: "League of Legends", tier: "Varsity", wins: 9, losses: 1, streak: 6 },
  { id: "t6", schoolId: "s2", name: "Fishers Tigers — RL", game: "Rocket League", tier: "Varsity", wins: 4, losses: 6, streak: -1 },
  { id: "t7", schoolId: "s3", name: "HSE Royals — LoL", game: "League of Legends", tier: "Varsity", wins: 7, losses: 3, streak: 2 },
  { id: "t8", schoolId: "s3", name: "HSE Royals — VAL", game: "Valorant", tier: "Varsity", wins: 8, losses: 2, streak: 3 },
  { id: "t9", schoolId: "s4", name: "NC Panthers — LoL", game: "League of Legends", tier: "Varsity", wins: 5, losses: 5, streak: 1 },
  { id: "t10", schoolId: "s5", name: "Center Grove Trojans — LoL", game: "League of Legends", tier: "Varsity", wins: 6, losses: 4, streak: -1 },
  { id: "t11", schoolId: "s6", name: "Brebeuf Braves — VAL", game: "Valorant", tier: "Varsity", wins: 6, losses: 4, streak: 2 },
  { id: "t12", schoolId: "s7", name: "Cathedral Irish — RL", game: "Rocket League", tier: "Varsity", wins: 7, losses: 3, streak: 3 },
  { id: "t13", schoolId: "s8", name: "Lawrence Central Bears — OW2", game: "Overwatch 2", tier: "Varsity", wins: 4, losses: 6, streak: -2 },
];

// --- Matches ------------------------------------------------------------

const today = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

const at = (daysFromToday: number, hour: number, minute = 0): Date => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
};

export const MATCHES: Match[] = [
  { id: "m1", homeTeamId: "t1", awayTeamId: "t5", game: "League of Legends", scheduledAt: at(0, 16, 30), status: "LIVE", homeScore: 1, awayScore: 1 },
  { id: "m2", homeTeamId: "t2", awayTeamId: "t12", game: "Rocket League", scheduledAt: at(0, 14, 0), status: "AWAITING_REPORT" },
  { id: "m3", homeTeamId: "t4", awayTeamId: "t11", game: "Super Smash Bros.", scheduledAt: at(0, 18, 0), status: "SCHEDULED", isUnified: true },
  { id: "m4", homeTeamId: "t3", awayTeamId: "t8", game: "Valorant", scheduledAt: at(1, 17, 0), status: "SCHEDULED" },
  { id: "m5", homeTeamId: "t1", awayTeamId: "t7", game: "League of Legends", scheduledAt: at(1, 19, 0), status: "SCHEDULED" },
  { id: "m6", homeTeamId: "t2", awayTeamId: "t6", game: "Rocket League", scheduledAt: at(2, 17, 30), status: "SCHEDULED" },
  { id: "m7", homeTeamId: "t1", awayTeamId: "t10", game: "League of Legends", scheduledAt: at(3, 16, 30), status: "SCHEDULED" },
  { id: "m8", homeTeamId: "t3", awayTeamId: "t11", game: "Valorant", scheduledAt: at(4, 18, 0), status: "SCHEDULED" },
  { id: "m9", homeTeamId: "t1", awayTeamId: "t9", game: "League of Legends", scheduledAt: at(-2, 17, 0), status: "CONFIRMED", homeScore: 2, awayScore: 1 },
  { id: "m10", homeTeamId: "t1", awayTeamId: "t10", game: "League of Legends", scheduledAt: at(-5, 17, 0), status: "CONFIRMED", homeScore: 2, awayScore: 0 },
];

// --- Coaches ------------------------------------------------------------

export const COACHES: Record<string, Coach> = {
  s1: { schoolId: "s1", name: "Coach Melendez", initials: "MM", email: "mmelendez@carmel.k12.in.us" },
  s2: { schoolId: "s2", name: "Coach Patel", initials: "RP", email: "rpatel@hse.k12.in.us" },
  s3: { schoolId: "s3", name: "Coach Vasquez", initials: "EV", email: "evasquez@hse.k12.in.us" },
  s4: { schoolId: "s4", name: "Coach Reed", initials: "JR", email: "jreed@nc.k12.in.us" },
  s5: { schoolId: "s5", name: "Coach Nakamura", initials: "TN", email: "tnakamura@cgv.k12.in.us" },
  s6: { schoolId: "s6", name: "Coach Reyes", initials: "AR", email: "areyes@brebeuf.org" },
  s7: { schoolId: "s7", name: "Coach O'Sullivan", initials: "PO", email: "posullivan@cathedral.org" },
  s8: { schoolId: "s8", name: "Coach Wright", initials: "DW", email: "dwright@lawrence.k12.in.us" },
};

// --- Match messages -----------------------------------------------------

export const MATCH_MESSAGES: MatchMessage[] = [
  { id: "msg1", matchId: "m1", authorSchoolId: "s2", body: "Lobby code 4F92K. See you in there.", ago: "45m", kind: "text" },
  { id: "msg2", matchId: "m1", authorSchoolId: "s1", body: "In. GLHF.", ago: "44m", kind: "text" },
  { id: "msg3", matchId: "m1", authorSchoolId: "system", body: "Game 1 started · 16:32 ET", ago: "32m", kind: "system" },
  { id: "msg4", matchId: "m1", authorSchoolId: "system", body: "Game 1 — Carmel wins · 28:14", ago: "20m", kind: "system" },
  { id: "msg5", matchId: "m1", authorSchoolId: "s2", body: "GG. Going to swap mid for game 2.", ago: "18m", kind: "text" },
  { id: "msg6", matchId: "m1", authorSchoolId: "system", body: "Game 2 — Fishers wins · 31:42", ago: "5m", kind: "system" },
  { id: "msg7", matchId: "m1", authorSchoolId: "s1", body: "Ggwp. Coffee break before game 3?", ago: "3m", kind: "text" },
  { id: "msg10", matchId: "m2", authorSchoolId: "s7", body: "Hey — running 5 min late, sorry. School bus back from track meet.", ago: "3h", kind: "text" },
  { id: "msg11", matchId: "m2", authorSchoolId: "s1", body: "All good. We'll start whenever you're ready.", ago: "3h", kind: "text" },
  { id: "msg12", matchId: "m2", authorSchoolId: "system", body: "Match started · 14:08 ET", ago: "2h", kind: "system" },
  { id: "msg13", matchId: "m2", authorSchoolId: "s7", body: "GG. Tough series. Will confirm the report tonight.", ago: "1h", kind: "text" },
  { id: "msg14", matchId: "m2", authorSchoolId: "s1", body: "Submitted. Thanks coach.", ago: "1h", kind: "text" },
  { id: "msg15", matchId: "m2", authorSchoolId: "s1", body: "[scoreboard-game1.png]", ago: "1h", kind: "evidence", attachment: "scoreboard-game1.png" },
  { id: "msg20", matchId: "m4", authorSchoolId: "s3", body: "Looking forward to tomorrow. We're starting at 5pm sharp on our end.", ago: "1d", kind: "text" },
  { id: "msg21", matchId: "m4", authorSchoolId: "s1", body: "Sounds good. Map veto in the discord 10 min before?", ago: "1d", kind: "text" },
  { id: "msg22", matchId: "m4", authorSchoolId: "s3", body: "Perfect. See you there.", ago: "23h", kind: "text" },
  { id: "msg30", matchId: "m3", authorSchoolId: "s6", body: "Confirming our roster — bringing 6 players, 2 partners. Ready when you are.", ago: "5h", kind: "text" },
  { id: "msg31", matchId: "m3", authorSchoolId: "s1", body: "Same here. Thanks for accommodating the schedule shift!", ago: "4h", kind: "text" },
];

// --- Match reports ------------------------------------------------------

export const MATCH_REPORTS: MatchReport[] = [
  {
    id: "r1",
    matchId: "m2",
    reportedByCoachSchoolId: "s1",
    homeScore: 4,
    awayScore: 2,
    evidenceUrls: ["scoreboard-game1.png", "scoreboard-game2.png", "scoreboard-game3.png"],
    notes: "Clean series. GG to Cathedral. Game 2 lobby crashed at 1-1 — replay attached.",
    submittedAgo: "1h",
  },
  {
    id: "r2",
    matchId: "m9",
    reportedByCoachSchoolId: "s1",
    homeScore: 2,
    awayScore: 1,
    evidenceUrls: ["nc-final-score.png"],
    notes: "Game 1 was a stomp, NC took game 2 in OT, game 3 we closed it.",
    submittedAgo: "2d",
  },
  {
    id: "r3",
    matchId: "m9",
    reportedByCoachSchoolId: "s4",
    homeScore: 2,
    awayScore: 1,
    evidenceUrls: ["nc-confirm.png"],
    notes: "Confirmed. Solid series.",
    submittedAgo: "2d",
  },
];

// --- Announcements ------------------------------------------------------

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "an1",
    title: "Spring Playoffs bracket released",
    body: "Top 16 teams across each title locked in. First round opens Friday — coaches, please confirm rosters by Thursday 5pm.",
    pinned: true,
    audience: "League",
    postedAt: "Today",
  },
  {
    id: "an2",
    title: "Unified Smash Showcase next Saturday",
    body: "Open invite for all Unified rosters. Travel reimbursement available for member schools.",
    audience: "League",
    postedAt: "Yesterday",
  },
  {
    id: "an3",
    title: "Valorant patch 8.07 — server impact",
    body: "Riot has confirmed server upgrades Wed 2–4am ET. No matches affected.",
    audience: "Division",
    postedAt: "2d ago",
  },
];
