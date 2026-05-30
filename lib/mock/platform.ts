/**
 * Platform-level mock data — RIEL.GG as a multi-tenant platform.
 * Each `League` here is a customer / tenant (HEA, Esports Ohio, etc.).
 */

export type LeagueStatus = "ACTIVE" | "ONBOARDING" | "TRIAL" | "PAUSED";
export type ClassificationKind = "SCHOLASTIC" | "COLLEGIATE" | "AMATEUR";

export type PlatformLeague = {
  id: string;
  name: string;
  shortName: string;
  slug: string; // becomes subdomain: ${slug}.riel.gg
  description: string;
  primaryColor: string;
  secondaryColor?: string;
  classification: ClassificationKind;
  region: string;
  status: LeagueStatus;
  ownerName: string;
  ownerEmail: string;
  // Snapshot metrics
  schoolCount: number;
  pendingSchoolCount: number;
  competitionCount: number;
  activeCoaches: number;
  activePlayers: number;
  matchesThisWeek: number;
  // Lifecycle
  createdAgo: string;
  trialEndsIn?: string;
  isPlatformDefault?: boolean;
};

export const PLATFORM_LEAGUES: PlatformLeague[] = [
  {
    id: "lg-riel",
    name: "RIEL Esports League",
    shortName: "RIEL",
    slug: "riel",
    description: "Premium scholastic esports — RIEL Spring 2026 season.",
    primaryColor: "#A31F34",
    secondaryColor: "#FFCC00",
    classification: "SCHOLASTIC",
    region: "National",
    status: "ACTIVE",
    ownerName: "Carlos Melendez",
    ownerEmail: "cmelendez@riel.gg",
    schoolCount: 32,
    pendingSchoolCount: 4,
    competitionCount: 5,
    activeCoaches: 78,
    activePlayers: 612,
    matchesThisWeek: 47,
    createdAgo: "8mo",
    isPlatformDefault: true,
  },
  {
    id: "lg-hea",
    name: "Hoosier Esports Alliance",
    shortName: "HEA",
    slug: "hea",
    description: "Indiana high school scholastic esports — varsity, JV, and Unified divisions.",
    primaryColor: "#0F4D8C",
    secondaryColor: "#F5A623",
    classification: "SCHOLASTIC",
    region: "Indiana",
    status: "ACTIVE",
    ownerName: "Jamie Holcomb",
    ownerEmail: "jholcomb@hoosieresports.org",
    schoolCount: 41,
    pendingSchoolCount: 6,
    competitionCount: 7,
    activeCoaches: 92,
    activePlayers: 784,
    matchesThisWeek: 62,
    createdAgo: "5mo",
  },
  {
    id: "lg-esohio",
    name: "Esports Ohio",
    shortName: "EO",
    slug: "esports-ohio",
    description: "Ohio scholastic esports league — varsity divisions across 8 game titles.",
    primaryColor: "#C8102E",
    secondaryColor: "#231F20",
    classification: "SCHOLASTIC",
    region: "Ohio",
    status: "ACTIVE",
    ownerName: "Marcus Weaver",
    ownerEmail: "mweaver@esportsohio.org",
    schoolCount: 28,
    pendingSchoolCount: 3,
    competitionCount: 4,
    activeCoaches: 54,
    activePlayers: 421,
    matchesThisWeek: 31,
    createdAgo: "3mo",
  },
  {
    id: "lg-michcollegiate",
    name: "Michigan Collegiate Esports",
    shortName: "MCE",
    slug: "michigan-collegiate",
    description: "Big Ten + MAC collegiate esports conference. Varsity and Premier divisions.",
    primaryColor: "#00274C",
    secondaryColor: "#FFCB05",
    classification: "COLLEGIATE",
    region: "Michigan",
    status: "TRIAL",
    ownerName: "Dr. Anika Patel",
    ownerEmail: "apatel@umich.edu",
    schoolCount: 12,
    pendingSchoolCount: 2,
    competitionCount: 3,
    activeCoaches: 24,
    activePlayers: 198,
    matchesThisWeek: 14,
    createdAgo: "2w",
    trialEndsIn: "12d",
  },
  {
    id: "lg-prairie",
    name: "Prairie Conference Esports",
    shortName: "PCE",
    slug: "prairie",
    description: "Iowa, Nebraska, Kansas regional scholastic conference.",
    primaryColor: "#7C2D12",
    secondaryColor: "#FCD34D",
    classification: "SCHOLASTIC",
    region: "Midwest",
    status: "ONBOARDING",
    ownerName: "Steven Holm",
    ownerEmail: "sholm@prairieconference.org",
    schoolCount: 0,
    pendingSchoolCount: 0,
    competitionCount: 0,
    activeCoaches: 0,
    activePlayers: 0,
    matchesThisWeek: 0,
    createdAgo: "3d",
  },
];

export function leagueById(id: string): PlatformLeague | undefined {
  return PLATFORM_LEAGUES.find((l) => l.id === id);
}

// --- Platform-level totals -----------------------------------------------

export const PLATFORM_TOTALS = {
  totalLeagues: PLATFORM_LEAGUES.length,
  activeLeagues: PLATFORM_LEAGUES.filter((l) => l.status === "ACTIVE").length,
  trialLeagues: PLATFORM_LEAGUES.filter((l) => l.status === "TRIAL").length,
  onboardingLeagues: PLATFORM_LEAGUES.filter((l) => l.status === "ONBOARDING").length,
  totalSchools: PLATFORM_LEAGUES.reduce((s, l) => s + l.schoolCount, 0),
  totalCoaches: PLATFORM_LEAGUES.reduce((s, l) => s + l.activeCoaches, 0),
  totalPlayers: PLATFORM_LEAGUES.reduce((s, l) => s + l.activePlayers, 0),
  matchesThisWeek: PLATFORM_LEAGUES.reduce((s, l) => s + l.matchesThisWeek, 0),
};

// --- Platform activity feed ----------------------------------------------

export type PlatformActivityKind =
  | "league_created"
  | "league_activated"
  | "school_joined"
  | "trial_started"
  | "billing_event";

export type PlatformActivityItem = {
  id: string;
  kind: PlatformActivityKind;
  leagueId?: string;
  actor: string;
  body: string;
  ago: string;
};

export const PLATFORM_ACTIVITY: PlatformActivityItem[] = [
  { id: "pa1", kind: "league_created", leagueId: "lg-prairie", actor: "Steven Holm", body: "created Prairie Conference Esports", ago: "3d" },
  { id: "pa2", kind: "trial_started", leagueId: "lg-michcollegiate", actor: "Dr. Anika Patel", body: "started 14-day trial for Michigan Collegiate Esports", ago: "2w" },
  { id: "pa3", kind: "school_joined", leagueId: "lg-hea", actor: "Crown Point HS", body: "joined Hoosier Esports Alliance", ago: "5h" },
  { id: "pa4", kind: "school_joined", leagueId: "lg-esohio", actor: "Hudson HS", body: "joined Esports Ohio", ago: "1d" },
  { id: "pa5", kind: "league_activated", leagueId: "lg-esohio", actor: "Marcus Weaver", body: "activated Esports Ohio (left trial)", ago: "3w" },
  { id: "pa6", kind: "billing_event", leagueId: "lg-hea", actor: "HEA", body: "renewed annual subscription — Tier 2 (50 schools)", ago: "2mo" },
];

// --- Current user's league memberships ----------------------------------

// Mock: user is platform owner, owns RIEL, is a coach at MCHS.
// In a real app this would derive from session + memberships.
export const USER_LEAGUE_MEMBERSHIPS = [
  { leagueId: "lg-riel", role: "OWNER" as const },
  { leagueId: "lg-hea", role: "ADMIN" as const }, // Could also admin HEA in this demo
];

// --- Game titles available on the platform ------------------------------

export type PlatformGame = {
  id: string;
  name: string;
  publisher: string;
  formats: string[];
  popularity: number; // 0-100, used for default-on suggestions
};

export const PLATFORM_GAMES: PlatformGame[] = [
  { id: "lol", name: "League of Legends", publisher: "Riot Games", formats: ["5v5"], popularity: 95 },
  { id: "val", name: "Valorant", publisher: "Riot Games", formats: ["5v5"], popularity: 92 },
  { id: "rl", name: "Rocket League", publisher: "Psyonix / Epic", formats: ["3v3", "2v2", "1v1"], popularity: 88 },
  { id: "ow2", name: "Overwatch 2", publisher: "Blizzard", formats: ["5v5"], popularity: 70 },
  { id: "smash", name: "Super Smash Bros. Ultimate", publisher: "Nintendo", formats: ["1v1", "Crew"], popularity: 78 },
  { id: "fortnite", name: "Fortnite", publisher: "Epic Games", formats: ["Squads", "Duos", "Solo"], popularity: 82 },
  { id: "nba2k", name: "NBA 2K", publisher: "2K", formats: ["1v1", "3v3"], popularity: 60 },
  { id: "rivals", name: "Marvel Rivals", publisher: "NetEase", formats: ["6v6"], popularity: 55 },
  { id: "mariokart", name: "Mario Kart", publisher: "Nintendo", formats: ["1v1", "4v4 Team"], popularity: 50 },
  { id: "chess", name: "Chess", publisher: "Chess.com", formats: ["1v1", "Team Match"], popularity: 40 },
];
