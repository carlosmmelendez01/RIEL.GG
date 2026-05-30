/**
 * Admin-side mock data — league office view.
 * Coexists with lib/mock/data.ts (coach side); both will swap to Prisma queries.
 */

import { SCHOOLS, TEAMS, MATCHES, type GameTitle } from "@/lib/mock/data";

// --- League ---------------------------------------------------------------

export const LEAGUE = {
  id: "league-riel",
  name: "RIEL Esports League",
  shortName: "RIEL",
  slug: "riel",
  description: "Premium scholastic esports — RIEL Spring 2026 season.",
  classification: "SCHOLASTIC" as const,
  primaryColor: "#A31F34",
  memberSchools: 32,
  activeCoaches: 78,
  activePlayers: 612,
  competitionsLive: 5,
  matchesThisWeek: 47,
};

// --- Admin user (you, in admin mode) -------------------------------------

export const ADMIN_USER = {
  name: "Carlos Melendez",
  initials: "CM",
  role: "League Admin",
  email: "cmelendez@hoosieresports.org",
};

// --- School approval queue + member directory ---------------------------

export type SchoolMembershipStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export type SchoolDirEntry = {
  schoolId: string;
  status: SchoolMembershipStatus;
  ncesVerified: boolean;
  ownerName?: string;
  ownerEmail?: string;
  joinedAgo: string;
  teamCount: number;
  pendingItems?: number;
};

export const SCHOOL_DIRECTORY: SchoolDirEntry[] = [
  { schoolId: "s1", status: "ACTIVE", ncesVerified: true, ownerName: "Carlos Melendez", ownerEmail: "cmelendez@carmel.k12.in.us", joinedAgo: "8mo", teamCount: 4 },
  { schoolId: "s2", status: "ACTIVE", ncesVerified: true, ownerName: "Coach Patel", ownerEmail: "rpatel@fishers.k12.in.us", joinedAgo: "2y", teamCount: 6 },
  { schoolId: "s3", status: "ACTIVE", ncesVerified: true, ownerName: "Coach Vasquez", ownerEmail: "evasquez@hse.k12.in.us", joinedAgo: "2y", teamCount: 5 },
  { schoolId: "s4", status: "ACTIVE", ncesVerified: true, ownerName: "Coach Reed", ownerEmail: "jreed@nc.k12.in.us", joinedAgo: "1y", teamCount: 3 },
  { schoolId: "s5", status: "ACTIVE", ncesVerified: true, ownerName: "Coach Nakamura", ownerEmail: "tnakamura@cgv.k12.in.us", joinedAgo: "1y", teamCount: 5 },
  { schoolId: "s6", status: "ACTIVE", ncesVerified: true, ownerName: "Coach Reyes", ownerEmail: "areyes@brebeuf.org", joinedAgo: "10mo", teamCount: 3, pendingItems: 1 },
  { schoolId: "s7", status: "ACTIVE", ncesVerified: true, ownerName: "Coach O'Sullivan", ownerEmail: "posullivan@cathedral.org", joinedAgo: "8mo", teamCount: 4 },
  { schoolId: "s8", status: "ACTIVE", ncesVerified: true, ownerName: "Coach Wright", ownerEmail: "dwright@lawrence.k12.in.us", joinedAgo: "6mo", teamCount: 2, pendingItems: 2 },
];

export type PendingSchool = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  ncesVerified: boolean;
  appliedBy: string;
  appliedByEmail: string;
  appliedAgo: string;
  reason: string;
};

export const PENDING_SCHOOLS: PendingSchool[] = [
  {
    id: "ps1",
    name: "Plainfield High School",
    shortName: "Plainfield",
    city: "Plainfield",
    state: "IN",
    ncesVerified: true,
    appliedBy: "John Newbold",
    appliedByEmail: "jnewbold@plainfield.k12.in.us",
    appliedAgo: "3d",
    reason: "Returning member — was in RIEL Fall 2025",
  },
  {
    id: "ps2",
    name: "Westfield High School",
    shortName: "Westfield",
    city: "Westfield",
    state: "IN",
    ncesVerified: true,
    appliedBy: "Jamie Holcomb",
    appliedByEmail: "jholcomb@wws.k12.in.us",
    appliedAgo: "1d",
    reason: "First-time application — Varsity Rocket League + Smash",
  },
  {
    id: "ps3",
    name: "Zionsville Community HS",
    shortName: "Zionsville",
    city: "Zionsville",
    state: "IN",
    ncesVerified: true,
    appliedBy: "Tomás Velez",
    appliedByEmail: "tvelez@zcs.k12.in.us",
    appliedAgo: "5h",
    reason: "First-time application — JV across all titles",
  },
  {
    id: "ps4",
    name: "Crown Point High School",
    shortName: "Crown Point",
    city: "Crown Point",
    state: "IN",
    ncesVerified: false,
    appliedBy: "Ricardo Jenkins",
    appliedByEmail: "rjenkins@cps.k12.in.us",
    appliedAgo: "8h",
    reason: "First-time application — needs NCES verification",
  },
];

// --- Competitions catalog ------------------------------------------------

export type CompetitionState = "DRAFT" | "ACTIVE" | "COMPLETE";
export type CompetitionStatus = "SEEDING" | "IN_PROGRESS" | "FINISHED";

export type AdminCompetition = {
  id: string;
  name: string;
  game: GameTitle;
  tier: "Varsity" | "JV" | "Unified";
  seasonName: string;
  state: CompetitionState;
  status: CompetitionStatus;
  registeredTeams: number;
  expectedTeams: number;
  startsAt: Date;
  endsAt: Date;
  stages: { name: string; kind: string; weeks: number }[];
};

const today = new Date();
const daysFrom = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

export const COMPETITIONS: AdminCompetition[] = [
  {
    id: "c1",
    name: "Spring 2026 — League of Legends Varsity",
    game: "League of Legends",
    tier: "Varsity",
    seasonName: "Spring 2026",
    state: "ACTIVE",
    status: "IN_PROGRESS",
    registeredTeams: 12,
    expectedTeams: 16,
    startsAt: daysFrom(-49),
    endsAt: daysFrom(28),
    stages: [
      { name: "League Play", kind: "ROUND_ROBIN", weeks: 8 },
      { name: "Playoffs", kind: "SINGLE_ELIM", weeks: 2 },
    ],
  },
  {
    id: "c2",
    name: "Spring 2026 — Valorant Varsity",
    game: "Valorant",
    tier: "Varsity",
    seasonName: "Spring 2026",
    state: "ACTIVE",
    status: "IN_PROGRESS",
    registeredTeams: 10,
    expectedTeams: 12,
    startsAt: daysFrom(-49),
    endsAt: daysFrom(28),
    stages: [
      { name: "League Play", kind: "ROUND_ROBIN", weeks: 8 },
      { name: "Playoffs", kind: "DOUBLE_ELIM", weeks: 2 },
    ],
  },
  {
    id: "c3",
    name: "Spring 2026 — Rocket League Varsity",
    game: "Rocket League",
    tier: "Varsity",
    seasonName: "Spring 2026",
    state: "ACTIVE",
    status: "IN_PROGRESS",
    registeredTeams: 14,
    expectedTeams: 16,
    startsAt: daysFrom(-49),
    endsAt: daysFrom(28),
    stages: [
      { name: "League Play", kind: "ROUND_ROBIN", weeks: 8 },
      { name: "Playoffs", kind: "DOUBLE_ELIM", weeks: 2 },
    ],
  },
  {
    id: "c4",
    name: "Spring 2026 — Super Smash Bros. Unified",
    game: "Super Smash Bros.",
    tier: "Unified",
    seasonName: "Spring 2026",
    state: "ACTIVE",
    status: "IN_PROGRESS",
    registeredTeams: 8,
    expectedTeams: 10,
    startsAt: daysFrom(-35),
    endsAt: daysFrom(35),
    stages: [
      { name: "Round Robin", kind: "ROUND_ROBIN", weeks: 6 },
      { name: "Showcase", kind: "CUSTOM", weeks: 1 },
    ],
  },
  {
    id: "c5",
    name: "Spring 2026 — Overwatch 2 Varsity",
    game: "Overwatch 2",
    tier: "Varsity",
    seasonName: "Spring 2026",
    state: "ACTIVE",
    status: "SEEDING",
    registeredTeams: 6,
    expectedTeams: 10,
    startsAt: daysFrom(7),
    endsAt: daysFrom(70),
    stages: [
      { name: "League Play", kind: "ROUND_ROBIN", weeks: 8 },
      { name: "Playoffs", kind: "SINGLE_ELIM", weeks: 2 },
    ],
  },
  {
    id: "c6",
    name: "Fall 2025 — League of Legends Varsity",
    game: "League of Legends",
    tier: "Varsity",
    seasonName: "Fall 2025",
    state: "COMPLETE",
    status: "FINISHED",
    registeredTeams: 14,
    expectedTeams: 16,
    startsAt: daysFrom(-180),
    endsAt: daysFrom(-90),
    stages: [
      { name: "League Play", kind: "ROUND_ROBIN", weeks: 8 },
      { name: "Playoffs", kind: "SINGLE_ELIM", weeks: 2 },
    ],
  },
  {
    id: "c7",
    name: "Spring 2026 — Rocket League JV",
    game: "Rocket League",
    tier: "JV",
    seasonName: "Spring 2026",
    state: "DRAFT",
    status: "SEEDING",
    registeredTeams: 0,
    expectedTeams: 8,
    startsAt: daysFrom(14),
    endsAt: daysFrom(77),
    stages: [{ name: "Round Robin", kind: "ROUND_ROBIN", weeks: 6 }],
  },
];

export function competitionById(id: string): AdminCompetition | undefined {
  return COMPETITIONS.find((c) => c.id === id);
}

// --- Recent admin activity ----------------------------------------------

export type AdminActivityItem = {
  id: string;
  kind: "school_applied" | "school_approved" | "competition_created" | "match_disputed" | "schedule_generated" | "report_confirmed";
  actor: string;
  body: string;
  ago: string;
};

export const ADMIN_ACTIVITY: AdminActivityItem[] = [
  { id: "aa1", kind: "school_applied", actor: "John Newbold (Plainfield HS)", body: "applied to join RIEL", ago: "5h" },
  { id: "aa2", kind: "match_disputed", actor: "Coach Patel · Fishers", body: "disputed match m104 score (Valorant Varsity)", ago: "1h" },
  { id: "aa3", kind: "schedule_generated", actor: "Auto-scheduler", body: "regenerated Rocket League JV schedule (8 teams, 12 weeks)", ago: "3h" },
  { id: "aa4", kind: "report_confirmed", actor: "League Office", body: "confirmed HSE def. NC 2-0 (LoL Varsity)", ago: "6h" },
  { id: "aa5", kind: "school_approved", actor: "You", body: "approved Carmel HS — Spring 2026 LoL Varsity registration", ago: "1d" },
  { id: "aa6", kind: "competition_created", actor: "You", body: "created Spring 2026 — Rocket League JV (Draft)", ago: "1d" },
  { id: "aa7", kind: "school_applied", actor: "Jamie Holcomb (Westfield HS)", body: "applied to join RIEL", ago: "1d" },
  { id: "aa8", kind: "school_applied", actor: "Tomás Velez (Zionsville HS)", body: "applied to join RIEL", ago: "5h" },
];

// --- Disputes queue ------------------------------------------------------

export type DisputeItem = {
  id: string;
  matchId: string;
  competitionName: string;
  teamA: string;
  teamB: string;
  reason: string;
  raisedBy: string;
  ago: string;
};

export const DISPUTES: DisputeItem[] = [
  {
    id: "d1",
    matchId: "m104",
    competitionName: "Valorant Varsity",
    teamA: "Fishers",
    teamB: "Brebeuf",
    reason: "Score mismatch — Fishers reports 2-1, Brebeuf reports 2-2 (final game disputed)",
    raisedBy: "Coach Patel · Fishers",
    ago: "1h",
  },
];

// --- Helper exports ------------------------------------------------------

export { SCHOOLS, TEAMS, MATCHES };
