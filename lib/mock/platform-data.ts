/**
 * Cross-platform mock data — feeds the rest of the /platform/* pages.
 * Pulls from PLATFORM_LEAGUES so league memberships stay consistent.
 */

import { PLATFORM_LEAGUES } from "@/lib/mock/platform";

// =====================================================================
// SCHOOLS INDEX — every school across every league
// =====================================================================

export type PlatformSchoolStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

export type PlatformSchool = {
  id: string;
  name: string;
  shortName: string;
  code: string;
  city: string;
  state: string;
  ncesId?: string;
  ncesVerified: boolean;
  primaryColor: string;
  ownerName: string;
  ownerEmail: string;
  studentCount: number;
  // Which leagues this school participates in (subset of PLATFORM_LEAGUES.id)
  leagueIds: string[];
  status: PlatformSchoolStatus;
  joinedAgo: string;
};

export const PLATFORM_SCHOOLS: PlatformSchool[] = [
  // RIEL Esports League schools (Indianapolis area mostly)
  { id: "ps-mchs", name: "Michigan City High School", shortName: "Michigan City", code: "MCH", city: "Michigan City", state: "IN", ncesId: "180519000234", ncesVerified: true, primaryColor: "#1f3a8a", ownerName: "Carlos Melendez", ownerEmail: "cmelendez@mcas.k12.in.us", studentCount: 51, leagueIds: ["lg-riel"], status: "ACTIVE", joinedAgo: "8mo" },
  { id: "ps-carmel", name: "Carmel High School", shortName: "Carmel", code: "CAR", city: "Carmel", state: "IN", ncesId: "180519000156", ncesVerified: true, primaryColor: "#1f3a8a", ownerName: "Robert Han", ownerEmail: "rhan@carmel.k12.in.us", studentCount: 47, leagueIds: ["lg-riel", "lg-hea"], status: "ACTIVE", joinedAgo: "8mo" },
  { id: "ps-fishers", name: "Fishers High School", shortName: "Fishers", code: "FHS", city: "Fishers", state: "IN", ncesId: "180519000182", ncesVerified: true, primaryColor: "#7c2d12", ownerName: "Riya Patel", ownerEmail: "rpatel@hse.k12.in.us", studentCount: 38, leagueIds: ["lg-riel", "lg-hea"], status: "ACTIVE", joinedAgo: "2y" },
  { id: "ps-hse", name: "Hamilton Southeastern", shortName: "HSE", code: "HSE", city: "Fishers", state: "IN", ncesId: "180519000183", ncesVerified: true, primaryColor: "#365314", ownerName: "Elena Vasquez", ownerEmail: "evasquez@hse.k12.in.us", studentCount: 42, leagueIds: ["lg-riel"], status: "ACTIVE", joinedAgo: "2y" },
  { id: "ps-nch", name: "North Central HS", shortName: "North Central", code: "NCH", city: "Indianapolis", state: "IN", ncesId: "180519000201", ncesVerified: true, primaryColor: "#831843", ownerName: "Jonah Reed", ownerEmail: "jreed@nc.k12.in.us", studentCount: 33, leagueIds: ["lg-riel"], status: "ACTIVE", joinedAgo: "1y" },
  { id: "ps-cgv", name: "Center Grove HS", shortName: "Center Grove", code: "CGV", city: "Greenwood", state: "IN", ncesId: "180519000089", ncesVerified: true, primaryColor: "#581c87", ownerName: "Tessa Nakamura", ownerEmail: "tnakamura@cgv.k12.in.us", studentCount: 36, leagueIds: ["lg-riel"], status: "ACTIVE", joinedAgo: "1y" },
  { id: "ps-brebeuf", name: "Brebeuf Jesuit", shortName: "Brebeuf", code: "BRE", city: "Indianapolis", state: "IN", ncesId: "A0019840", ncesVerified: true, primaryColor: "#0c4a6e", ownerName: "Antonio Reyes", ownerEmail: "areyes@brebeuf.org", studentCount: 24, leagueIds: ["lg-riel"], status: "ACTIVE", joinedAgo: "10mo" },
  { id: "ps-cathedral", name: "Cathedral HS", shortName: "Cathedral", code: "CTH", city: "Indianapolis", state: "IN", ncesId: "A0019841", ncesVerified: true, primaryColor: "#78350f", ownerName: "Patrick O'Sullivan", ownerEmail: "posullivan@cathedral.org", studentCount: 28, leagueIds: ["lg-riel"], status: "ACTIVE", joinedAgo: "8mo" },

  // HEA schools (some overlap with RIEL)
  { id: "ps-westfield", name: "Westfield High School", shortName: "Westfield", code: "WST", city: "Westfield", state: "IN", ncesId: "180519000299", ncesVerified: true, primaryColor: "#0F4D8C", ownerName: "Jamie Holcomb", ownerEmail: "jholcomb@wws.k12.in.us", studentCount: 45, leagueIds: ["lg-hea"], status: "ACTIVE", joinedAgo: "5mo" },
  { id: "ps-zionsville", name: "Zionsville Community HS", shortName: "Zionsville", code: "ZON", city: "Zionsville", state: "IN", ncesId: "180519000310", ncesVerified: true, primaryColor: "#0F4D8C", ownerName: "Tomás Velez", ownerEmail: "tvelez@zcs.k12.in.us", studentCount: 31, leagueIds: ["lg-hea"], status: "ACTIVE", joinedAgo: "4mo" },
  { id: "ps-plainfield", name: "Plainfield High School", shortName: "Plainfield", code: "PFD", city: "Plainfield", state: "IN", ncesId: "180519000234", ncesVerified: true, primaryColor: "#7C1D1D", ownerName: "John Newbold", ownerEmail: "jnewbold@plainfield.k12.in.us", studentCount: 29, leagueIds: ["lg-hea"], status: "PENDING", joinedAgo: "3d" },
  { id: "ps-crownpoint", name: "Crown Point High School", shortName: "Crown Point", code: "CPT", city: "Crown Point", state: "IN", ncesId: undefined, ncesVerified: false, primaryColor: "#0F4D8C", ownerName: "Ricardo Jenkins", ownerEmail: "rjenkins@cps.k12.in.us", studentCount: 22, leagueIds: ["lg-hea"], status: "PENDING", joinedAgo: "8h" },

  // Esports Ohio schools
  { id: "ps-hudson", name: "Hudson High School", shortName: "Hudson", code: "HUD", city: "Hudson", state: "OH", ncesId: "390519000455", ncesVerified: true, primaryColor: "#C8102E", ownerName: "Maria Cole", ownerEmail: "mcole@hudson.k12.oh.us", studentCount: 34, leagueIds: ["lg-esohio"], status: "ACTIVE", joinedAgo: "3mo" },
  { id: "ps-mason", name: "Mason High School", shortName: "Mason", code: "MAS", city: "Mason", state: "OH", ncesId: "390519000812", ncesVerified: true, primaryColor: "#1E3A8A", ownerName: "Devon Henderson", ownerEmail: "dhenderson@masoncomets.org", studentCount: 39, leagueIds: ["lg-esohio"], status: "ACTIVE", joinedAgo: "3mo" },
  { id: "ps-shawnee", name: "Shawnee Mission East", shortName: "Shawnee East", code: "SHE", city: "Lima", state: "OH", ncesId: "390519000702", ncesVerified: true, primaryColor: "#15803d", ownerName: "Greg Tisdale", ownerEmail: "gtisdale@shawneeschools.com", studentCount: 26, leagueIds: ["lg-esohio"], status: "ACTIVE", joinedAgo: "2mo" },
  { id: "ps-strongsville", name: "Strongsville High School", shortName: "Strongsville", code: "STR", city: "Strongsville", state: "OH", ncesId: "390519000855", ncesVerified: true, primaryColor: "#7c2d12", ownerName: "Lisa Martinez", ownerEmail: "lmartinez@strongnet.org", studentCount: 32, leagueIds: ["lg-esohio"], status: "ACTIVE", joinedAgo: "2mo" },

  // Michigan Collegiate Esports schools
  { id: "ps-umich", name: "University of Michigan", shortName: "Michigan", code: "UM", city: "Ann Arbor", state: "MI", ncesId: "C0019901", ncesVerified: true, primaryColor: "#00274C", ownerName: "Dr. Anika Patel", ownerEmail: "apatel@umich.edu", studentCount: 88, leagueIds: ["lg-michcollegiate"], status: "ACTIVE", joinedAgo: "2w" },
  { id: "ps-msu", name: "Michigan State University", shortName: "Michigan State", code: "MSU", city: "East Lansing", state: "MI", ncesId: "C0019902", ncesVerified: true, primaryColor: "#15803D", ownerName: "Dr. Ben Liu", ownerEmail: "bliu@msu.edu", studentCount: 76, leagueIds: ["lg-michcollegiate"], status: "ACTIVE", joinedAgo: "2w" },

  // Pending applications
  { id: "ps-bishop", name: "Bishop Chatard HS", shortName: "Bishop Chatard", code: "BCH", city: "Indianapolis", state: "IN", ncesId: "A0019842", ncesVerified: true, primaryColor: "#831843", ownerName: "Father Daniel Quinn", ownerEmail: "dquinn@bishopchatard.org", studentCount: 0, leagueIds: ["lg-hea"], status: "PENDING", joinedAgo: "1d" },
];

export function platformSchoolById(id: string) {
  return PLATFORM_SCHOOLS.find((s) => s.id === id);
}

// =====================================================================
// OWNERS & ADMINS — anyone with privileged access at any league
// =====================================================================

export type AdminRoleScope = "OWNER" | "ADMIN" | "STAFF";

export type PlatformAdmin = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: AdminRoleScope;
  // Which leagues they admin
  leagueIds: string[];
  status: "ACTIVE" | "INVITED" | "INACTIVE";
  lastActiveAgo?: string;
  joinedAgo: string;
};

export const PLATFORM_ADMINS: PlatformAdmin[] = [
  { id: "pa-cm", name: "Carlos Melendez", initials: "CM", email: "cmelendez@riel.gg", role: "OWNER", leagueIds: ["lg-riel"], status: "ACTIVE", lastActiveAgo: "now", joinedAgo: "8mo" },
  { id: "pa-jh", name: "Jamie Holcomb", initials: "JH", email: "jholcomb@hoosieresports.org", role: "OWNER", leagueIds: ["lg-hea"], status: "ACTIVE", lastActiveAgo: "12m", joinedAgo: "5mo" },
  { id: "pa-mw", name: "Marcus Weaver", initials: "MW", email: "mweaver@esportsohio.org", role: "OWNER", leagueIds: ["lg-esohio"], status: "ACTIVE", lastActiveAgo: "1h", joinedAgo: "3mo" },
  { id: "pa-ap", name: "Dr. Anika Patel", initials: "AP", email: "apatel@umich.edu", role: "OWNER", leagueIds: ["lg-michcollegiate"], status: "ACTIVE", lastActiveAgo: "3h", joinedAgo: "2w" },
  { id: "pa-sh", name: "Steven Holm", initials: "SH", email: "sholm@prairieconference.org", role: "OWNER", leagueIds: ["lg-prairie"], status: "INVITED", lastActiveAgo: undefined, joinedAgo: "3d" },

  // Co-admins / staff at HEA
  { id: "pa-rh", name: "Rachel Hines", initials: "RH", email: "rhines@hoosieresports.org", role: "ADMIN", leagueIds: ["lg-hea"], status: "ACTIVE", lastActiveAgo: "30m", joinedAgo: "4mo" },
  { id: "pa-mt", name: "Mike Tao", initials: "MT", email: "mtao@hoosieresports.org", role: "STAFF", leagueIds: ["lg-hea"], status: "ACTIVE", lastActiveAgo: "5h", joinedAgo: "2mo" },

  // Co-admins at Esports Ohio
  { id: "pa-bp", name: "Brittany Park", initials: "BP", email: "bpark@esportsohio.org", role: "ADMIN", leagueIds: ["lg-esohio"], status: "ACTIVE", lastActiveAgo: "1d", joinedAgo: "2mo" },
  { id: "pa-dg", name: "Devon Grant", initials: "DG", email: "dgrant@esportsohio.org", role: "STAFF", leagueIds: ["lg-esohio"], status: "INACTIVE", lastActiveAgo: "21d", joinedAgo: "2mo" },

  // Co-admin at MCE
  { id: "pa-bl", name: "Dr. Ben Liu", initials: "BL", email: "bliu@msu.edu", role: "ADMIN", leagueIds: ["lg-michcollegiate"], status: "ACTIVE", lastActiveAgo: "5d", joinedAgo: "2w" },
];

// =====================================================================
// COMPETITION TEMPLATES — reusable competition presets
// =====================================================================

export type PlatformTemplate = {
  id: string;
  name: string;
  description: string;
  game: string;
  tier: string;
  format: string;
  stages: string[];
  bestOf: number;
  weeks: number;
  recommended: boolean;
  usedByLeagueCount: number;
  usedByCompetitionCount: number;
  category: "VARSITY" | "JV" | "UNIFIED" | "TOURNAMENT" | "SHOWCASE";
};

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    id: "tpl-lol-varsity",
    name: "LoL Varsity Standard",
    description: "Round Robin → Single Elim Playoffs. Most common scholastic format for LoL.",
    game: "League of Legends",
    tier: "Varsity",
    format: "5v5",
    stages: ["League Play (8w)", "Playoffs (2w)"],
    bestOf: 3,
    weeks: 10,
    recommended: true,
    usedByLeagueCount: 4,
    usedByCompetitionCount: 7,
    category: "VARSITY",
  },
  {
    id: "tpl-val-varsity",
    name: "Valorant Varsity Standard",
    description: "Round Robin → Double Elim Playoffs. Tier-1 competitive format.",
    game: "Valorant",
    tier: "Varsity",
    format: "5v5",
    stages: ["League Play (8w)", "Playoffs (3w)"],
    bestOf: 3,
    weeks: 11,
    recommended: true,
    usedByLeagueCount: 3,
    usedByCompetitionCount: 5,
    category: "VARSITY",
  },
  {
    id: "tpl-rl-varsity",
    name: "Rocket League Varsity",
    description: "Faster pace — Bo5 series, 6-week regular season + 2-week playoffs.",
    game: "Rocket League",
    tier: "Varsity",
    format: "3v3",
    stages: ["League Play (6w)", "Playoffs (2w)"],
    bestOf: 5,
    weeks: 8,
    recommended: true,
    usedByLeagueCount: 4,
    usedByCompetitionCount: 6,
    category: "VARSITY",
  },
  {
    id: "tpl-smash-unified",
    name: "Smash Unified Showcase",
    description: "Inclusive program — round robin pairings with accessibility accommodations.",
    game: "Super Smash Bros. Ultimate",
    tier: "Unified",
    format: "1v1 Paired",
    stages: ["Round Robin (6w)", "Showcase (1w)"],
    bestOf: 3,
    weeks: 7,
    recommended: false,
    usedByLeagueCount: 2,
    usedByCompetitionCount: 3,
    category: "UNIFIED",
  },
  {
    id: "tpl-rl-jv",
    name: "Rocket League JV",
    description: "Beginner-friendly variant — shorter season, single elim, no rank gating.",
    game: "Rocket League",
    tier: "JV",
    format: "3v3",
    stages: ["Round Robin (6w)"],
    bestOf: 3,
    weeks: 6,
    recommended: false,
    usedByLeagueCount: 2,
    usedByCompetitionCount: 2,
    category: "JV",
  },
  {
    id: "tpl-tournament-cup",
    name: "Spring Cup (Single-Day)",
    description: "Single-day bracket tournament — open to any tier. Great for kickoff events.",
    game: "Multi-game",
    tier: "Open",
    format: "Bracket",
    stages: ["Bracket (1d)"],
    bestOf: 3,
    weeks: 1,
    recommended: false,
    usedByLeagueCount: 3,
    usedByCompetitionCount: 4,
    category: "TOURNAMENT",
  },
  {
    id: "tpl-fortnite-squad",
    name: "Fortnite Squad League",
    description: "Weekly squad sessions, point-based standings across cumulative match weeks.",
    game: "Fortnite",
    tier: "Varsity",
    format: "Squads (4)",
    stages: ["Weekly Sessions (8w)", "Final (1d)"],
    bestOf: 5,
    weeks: 9,
    recommended: false,
    usedByLeagueCount: 1,
    usedByCompetitionCount: 1,
    category: "VARSITY",
  },
  {
    id: "tpl-ow2-varsity",
    name: "Overwatch 2 Varsity",
    description: "Map-rotation per game with mode parity. Bo5 in playoffs.",
    game: "Overwatch 2",
    tier: "Varsity",
    format: "5v5",
    stages: ["League Play (8w)", "Playoffs (2w)"],
    bestOf: 3,
    weeks: 10,
    recommended: false,
    usedByLeagueCount: 2,
    usedByCompetitionCount: 3,
    category: "VARSITY",
  },
];

// =====================================================================
// SUPPORT TICKETS
// =====================================================================

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";

export type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  body: string;
  raisedByName: string;
  raisedByEmail: string;
  raisedByLeagueId?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId?: string;
  category: "BILLING" | "BUG" | "FEATURE" | "QUESTION" | "ABUSE" | "INTEGRATION";
  createdAgo: string;
  updatedAgo: string;
};

export const SUPPORT_TICKETS: SupportTicket[] = [
  { id: "tk-001", ticketNumber: "RIEL-1042", subject: "Schedule generator pinning broken", body: "Pinning a Friday match keeps getting overwritten when I regenerate the schedule.", raisedByName: "Jamie Holcomb", raisedByEmail: "jholcomb@hoosieresports.org", raisedByLeagueId: "lg-hea", priority: "HIGH", status: "IN_PROGRESS", assigneeId: "rs-3", category: "BUG", createdAgo: "2h", updatedAgo: "30m" },
  { id: "tk-002", ticketNumber: "RIEL-1041", subject: "How to set up Discord notifications for match reports?", body: "Looking to plug our Discord bot in for match-report notifications.", raisedByName: "Marcus Weaver", raisedByEmail: "mweaver@esportsohio.org", raisedByLeagueId: "lg-esohio", priority: "MEDIUM", status: "OPEN", category: "QUESTION", createdAgo: "5h", updatedAgo: "5h" },
  { id: "tk-003", ticketNumber: "RIEL-1040", subject: "Riot ID linking errors for new accounts", body: "Players who sign up after Friday can't link Riot IDs — getting a 401 from the API.", raisedByName: "Carlos Melendez", raisedByEmail: "cmelendez@riel.gg", raisedByLeagueId: "lg-riel", priority: "URGENT", status: "IN_PROGRESS", assigneeId: "rs-1", category: "INTEGRATION", createdAgo: "1d", updatedAgo: "1h" },
  { id: "tk-004", ticketNumber: "RIEL-1039", subject: "Trial extension request — Michigan Collegiate", body: "Need to extend our trial by 14 days; budget approval is taking longer than expected.", raisedByName: "Dr. Anika Patel", raisedByEmail: "apatel@umich.edu", raisedByLeagueId: "lg-michcollegiate", priority: "MEDIUM", status: "WAITING", assigneeId: "rs-4", category: "BILLING", createdAgo: "2d", updatedAgo: "2d" },
  { id: "tk-005", ticketNumber: "RIEL-1038", subject: "Add NHL '94 to game library", body: "Our schools have an interest in retro game tournaments. Could you add NHL '94?", raisedByName: "Steven Holm", raisedByEmail: "sholm@prairieconference.org", raisedByLeagueId: "lg-prairie", priority: "LOW", status: "OPEN", category: "FEATURE", createdAgo: "3d", updatedAgo: "3d" },
  { id: "tk-006", ticketNumber: "RIEL-1037", subject: "Coach reporting harassment in match chat", body: "Need to flag a player from another league. Provided screenshots in attachments.", raisedByName: "Tessa Nakamura", raisedByEmail: "tnakamura@cgv.k12.in.us", raisedByLeagueId: "lg-riel", priority: "HIGH", status: "IN_PROGRESS", assigneeId: "rs-2", category: "ABUSE", createdAgo: "4d", updatedAgo: "1d" },
  { id: "tk-007", ticketNumber: "RIEL-1036", subject: "How do I switch from trial to paid?", body: "We're committed — how do I move from trial to a paid plan?", raisedByName: "Dr. Ben Liu", raisedByEmail: "bliu@msu.edu", raisedByLeagueId: "lg-michcollegiate", priority: "MEDIUM", status: "RESOLVED", assigneeId: "rs-4", category: "BILLING", createdAgo: "5d", updatedAgo: "4d" },
  { id: "tk-008", ticketNumber: "RIEL-1035", subject: "Bracket renderer breaks on Safari mobile", body: "Brackets render upside-down on iOS Safari. Looks fine on Chrome.", raisedByName: "Rachel Hines", raisedByEmail: "rhines@hoosieresports.org", raisedByLeagueId: "lg-hea", priority: "MEDIUM", status: "OPEN", category: "BUG", createdAgo: "6d", updatedAgo: "6d" },
  { id: "tk-009", ticketNumber: "RIEL-1034", subject: "Bulk roster import — CSV template?", body: "Loading 60 players one-by-one is painful. Do you support CSV?", raisedByName: "Brittany Park", raisedByEmail: "bpark@esportsohio.org", raisedByLeagueId: "lg-esohio", priority: "LOW", status: "OPEN", category: "FEATURE", createdAgo: "7d", updatedAgo: "7d" },
  { id: "tk-010", ticketNumber: "RIEL-1033", subject: "Closed: dispute resolved between MCH and FHS", body: "Final game screenshot mismatch — both coaches reviewed video, agreed on outcome.", raisedByName: "Carlos Melendez", raisedByEmail: "cmelendez@riel.gg", raisedByLeagueId: "lg-riel", priority: "MEDIUM", status: "CLOSED", assigneeId: "rs-2", category: "QUESTION", createdAgo: "10d", updatedAgo: "8d" },
];

// =====================================================================
// AUDIT LOG
// =====================================================================

export type AuditEventKind =
  | "LEAGUE.CREATE"
  | "LEAGUE.UPDATE"
  | "LEAGUE.SUSPEND"
  | "SCHOOL.APPROVE"
  | "SCHOOL.REJECT"
  | "COMPETITION.CREATE"
  | "COMPETITION.ACTIVATE"
  | "MATCH.SCORE_EDIT"
  | "MATCH.CONFIRM"
  | "INVITE.ACTIVATE"
  | "INVITE.REVOKE"
  | "BILLING.UPGRADE"
  | "BILLING.DOWNGRADE"
  | "INTEGRATION.CONNECT"
  | "INTEGRATION.DISCONNECT"
  | "USER.ROLE_CHANGE"
  | "PLATFORM.SETTING_CHANGE";

export type AuditEvent = {
  id: string;
  ts: string; // relative
  actor: string;
  actorEmail?: string;
  action: AuditEventKind;
  description: string;
  leagueId?: string;
  ip?: string;
};

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: "au-001", ts: "5m ago", actor: "Carlos Melendez", actorEmail: "cmelendez@riel.gg", action: "PLATFORM.SETTING_CHANGE", description: "updated email notification template (new-league-welcome)", ip: "73.146.22.4" },
  { id: "au-002", ts: "30m ago", actor: "Jamie Holcomb", actorEmail: "jholcomb@hoosieresports.org", action: "SCHOOL.APPROVE", description: "approved Westfield High School to join HEA", leagueId: "lg-hea", ip: "73.150.108.117" },
  { id: "au-003", ts: "1h ago", actor: "Auto-system", action: "MATCH.CONFIRM", description: "auto-confirmed match m104 (24h timer expired)", leagueId: "lg-riel" },
  { id: "au-004", ts: "1h ago", actor: "Marcus Weaver", actorEmail: "mweaver@esportsohio.org", action: "INVITE.ACTIVATE", description: "activated invite for Crown Point HS (max uses=1, 7d expiry)", leagueId: "lg-esohio", ip: "104.234.12.99" },
  { id: "au-005", ts: "3h ago", actor: "Dr. Anika Patel", actorEmail: "apatel@umich.edu", action: "COMPETITION.CREATE", description: "created competition 'Spring 2026 — League of Legends Premier' (Draft)", leagueId: "lg-michcollegiate", ip: "141.211.144.10" },
  { id: "au-006", ts: "5h ago", actor: "Carlos Melendez", actorEmail: "cmelendez@riel.gg", action: "LEAGUE.CREATE", description: "created league 'Prairie Conference Esports' (Onboarding)", ip: "73.146.22.4" },
  { id: "au-007", ts: "8h ago", actor: "Rachel Hines", actorEmail: "rhines@hoosieresports.org", action: "MATCH.SCORE_EDIT", description: "edited match m087 score (2-1 → 2-0); confirmations reset", leagueId: "lg-hea", ip: "73.150.108.221" },
  { id: "au-008", ts: "1d ago", actor: "Carlos Melendez", actorEmail: "cmelendez@riel.gg", action: "INTEGRATION.CONNECT", description: "connected Riot Games API for RIEL Esports League", leagueId: "lg-riel", ip: "73.146.22.4" },
  { id: "au-009", ts: "1d ago", actor: "Jamie Holcomb", actorEmail: "jholcomb@hoosieresports.org", action: "USER.ROLE_CHANGE", description: "promoted Mike Tao to STAFF role on HEA", leagueId: "lg-hea", ip: "73.150.108.117" },
  { id: "au-010", ts: "2d ago", actor: "Dr. Anika Patel", actorEmail: "apatel@umich.edu", action: "BILLING.UPGRADE", description: "upgraded Michigan Collegiate Esports from Trial → Tier 2", leagueId: "lg-michcollegiate", ip: "141.211.144.10" },
  { id: "au-011", ts: "3d ago", actor: "Steven Holm", actorEmail: "sholm@prairieconference.org", action: "LEAGUE.CREATE", description: "self-served league creation 'Prairie Conference Esports'", ip: "199.5.83.41" },
  { id: "au-012", ts: "5d ago", actor: "Marcus Weaver", actorEmail: "mweaver@esportsohio.org", action: "COMPETITION.ACTIVATE", description: "activated 'Spring 2026 — Valorant Varsity' (Draft → Active)", leagueId: "lg-esohio", ip: "104.234.12.99" },
  { id: "au-013", ts: "1w ago", actor: "Carlos Melendez", actorEmail: "cmelendez@riel.gg", action: "INVITE.REVOKE", description: "revoked unused invite for ex-coach @ Brebeuf Jesuit", leagueId: "lg-riel", ip: "73.146.22.4" },
  { id: "au-014", ts: "2w ago", actor: "Carlos Melendez", actorEmail: "cmelendez@riel.gg", action: "PLATFORM.SETTING_CHANGE", description: "raised default trial length: 7d → 14d", ip: "73.146.22.4" },
  { id: "au-015", ts: "3w ago", actor: "Jamie Holcomb", actorEmail: "jholcomb@hoosieresports.org", action: "LEAGUE.UPDATE", description: "updated brand colors and logo for Hoosier Esports Alliance", leagueId: "lg-hea", ip: "73.150.108.117" },
];

// =====================================================================
// RIEL.GG STAFF — internal team
// =====================================================================

export type StaffRole = "FOUNDER" | "ADMIN" | "ENGINEER" | "SUPPORT" | "DESIGN" | "SALES";

export type RielStaff = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: StaffRole;
  title: string;
  status: "ACTIVE" | "INVITED" | "AWAY";
  lastActiveAgo?: string;
  joinedAgo: string;
};

export const RIEL_STAFF: RielStaff[] = [
  { id: "rs-1", name: "Carlos Melendez", initials: "CM", email: "cmelendez@riel.gg", role: "FOUNDER", title: "Founder & CEO", status: "ACTIVE", lastActiveAgo: "now", joinedAgo: "8mo" },
  { id: "rs-2", name: "Sarah Henderson", initials: "SH", email: "sarah@riel.gg", role: "ADMIN", title: "Head of Operations", status: "ACTIVE", lastActiveAgo: "12m", joinedAgo: "6mo" },
  { id: "rs-3", name: "Diego Romero", initials: "DR", email: "diego@riel.gg", role: "ENGINEER", title: "Lead Engineer", status: "ACTIVE", lastActiveAgo: "5m", joinedAgo: "5mo" },
  { id: "rs-4", name: "Priya Kapoor", initials: "PK", email: "priya@riel.gg", role: "SUPPORT", title: "Customer Success Lead", status: "ACTIVE", lastActiveAgo: "30m", joinedAgo: "4mo" },
  { id: "rs-5", name: "Jordan Lee", initials: "JL", email: "jordan@riel.gg", role: "DESIGN", title: "Design Lead", status: "AWAY", lastActiveAgo: "2d", joinedAgo: "3mo" },
  { id: "rs-6", name: "Tariq Brooks", initials: "TB", email: "tariq@riel.gg", role: "SALES", title: "Partnerships", status: "ACTIVE", lastActiveAgo: "1h", joinedAgo: "2mo" },
  { id: "rs-7", name: "Mei Ling", initials: "ML", email: "mei@riel.gg", role: "ENGINEER", title: "Backend Engineer", status: "INVITED", lastActiveAgo: undefined, joinedAgo: "5d" },
];

// =====================================================================
// INTEGRATIONS
// =====================================================================

export type IntegrationStatus = "CONNECTED" | "DEGRADED" | "DISCONNECTED" | "AVAILABLE";
export type IntegrationCategory = "GAME_API" | "COMMS" | "AUTH" | "ANALYTICS" | "PAYMENTS" | "DATA";

export type Integration = {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  connectedLeagueCount: number;
  totalLeagueCount: number;
  lastSyncAgo?: string;
  errorMessage?: string;
  iconLetter: string;
  iconColor: string;
};

export const INTEGRATIONS: Integration[] = [
  { id: "int-riot", name: "Riot Games API", description: "League of Legends + Valorant — auto-fetch match results, ranks, agent picks", category: "GAME_API", status: "CONNECTED", connectedLeagueCount: 4, totalLeagueCount: 5, lastSyncAgo: "5m", iconLetter: "R", iconColor: "#D13639" },
  { id: "int-epic", name: "Epic Games", description: "Fortnite + Rocket League — score validation, match telemetry", category: "GAME_API", status: "CONNECTED", connectedLeagueCount: 3, totalLeagueCount: 5, lastSyncAgo: "12m", iconLetter: "E", iconColor: "#313131" },
  { id: "int-blizzard", name: "Battle.net (Blizzard)", description: "Overwatch 2 — match results + per-player stats", category: "GAME_API", status: "DEGRADED", connectedLeagueCount: 2, totalLeagueCount: 5, lastSyncAgo: "3h", errorMessage: "API rate-limited — auto-syncs throttled to 1/min", iconLetter: "B", iconColor: "#00AEFF" },
  { id: "int-discord", name: "Discord", description: "League announcements, match-day alerts, dispute escalation channels", category: "COMMS", status: "CONNECTED", connectedLeagueCount: 5, totalLeagueCount: 5, lastSyncAgo: "1m", iconLetter: "D", iconColor: "#5865F2" },
  { id: "int-google", name: "Google Workspace SSO", description: "Single sign-on for school accounts (.k12.in.us, .edu, etc.)", category: "AUTH", status: "CONNECTED", connectedLeagueCount: 5, totalLeagueCount: 5, lastSyncAgo: "1m", iconLetter: "G", iconColor: "#4285F4" },
  { id: "int-microsoft", name: "Microsoft Entra (Azure AD)", description: "SSO for districts using Microsoft 365 / Office 365", category: "AUTH", status: "CONNECTED", connectedLeagueCount: 3, totalLeagueCount: 5, lastSyncAgo: "1m", iconLetter: "M", iconColor: "#F25022" },
  { id: "int-twitch", name: "Twitch", description: "Stream embeds + match VOD archival for league broadcasts", category: "COMMS", status: "AVAILABLE", connectedLeagueCount: 0, totalLeagueCount: 5, iconLetter: "T", iconColor: "#9146FF" },
  { id: "int-nces", name: "NCES School Database", description: "National Center for Education Statistics — verify scholastic schools at registration", category: "DATA", status: "CONNECTED", connectedLeagueCount: 5, totalLeagueCount: 5, lastSyncAgo: "12h", iconLetter: "N", iconColor: "#1F5037" },
  { id: "int-stripe", name: "Stripe", description: "Subscription billing, invoices, plan upgrades", category: "PAYMENTS", status: "CONNECTED", connectedLeagueCount: 4, totalLeagueCount: 5, lastSyncAgo: "10m", iconLetter: "S", iconColor: "#635BFF" },
  { id: "int-segment", name: "Segment", description: "Product analytics — track activation, engagement, churn signals", category: "ANALYTICS", status: "CONNECTED", connectedLeagueCount: 5, totalLeagueCount: 5, lastSyncAgo: "1m", iconLetter: "S", iconColor: "#52BD95" },
  { id: "int-twilio", name: "Twilio", description: "SMS notifications for match-day reminders + parent comms", category: "COMMS", status: "DISCONNECTED", connectedLeagueCount: 0, totalLeagueCount: 5, errorMessage: "Account suspended — billing issue", iconLetter: "T", iconColor: "#F22F46" },
  { id: "int-zoom", name: "Zoom", description: "Coaches' meeting + remote bracket draws", category: "COMMS", status: "AVAILABLE", connectedLeagueCount: 0, totalLeagueCount: 5, iconLetter: "Z", iconColor: "#2D8CFF" },
];

// Re-export PLATFORM_LEAGUES so consumers can pull schools + leagues from one module
export { PLATFORM_LEAGUES };
