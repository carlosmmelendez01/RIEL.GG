import { describe, expect, it } from "vitest";

import {
  can,
  assertCan,
  PermissionError,
  permissionsForLeagueRole,
  type Actor,
  type LeagueRole,
  type Permission,
  type SchoolRole,
} from "./permissions";

const LEAGUE_A = "league-ien";
const LEAGUE_B = "league-other";
const SCHOOL_A = "school-mchs";
const SCHOOL_B = "school-rival";

function actor(over: Partial<Actor> = {}): Actor {
  return { userId: "u-1", leagueRoles: [], schoolRoles: [], ...over };
}

function leagueAdmin(role: LeagueRole = "ADMIN", leagueId = LEAGUE_A): Actor {
  return actor({ leagueRoles: [{ leagueId, role }] });
}

function coach(role: SchoolRole = "HEAD_COACH", schoolId = SCHOOL_A): Actor {
  return actor({ schoolRoles: [{ schoolId, role }] });
}

// --- Tenant isolation (required scenarios 13 and 14) -------------------

describe("tenant isolation", () => {
  it("a League A admin holds no permission in League B (scenario 14)", () => {
    const a = leagueAdmin("ADMIN", LEAGUE_A);
    expect(can(a, "school.approve", { leagueId: LEAGUE_A })).toBe(true);
    expect(can(a, "school.approve", { leagueId: LEAGUE_B })).toBe(false);
    expect(can(a, "registration.registerForSchool", { leagueId: LEAGUE_B })).toBe(false);
    expect(can(a, "competition.publish", { leagueId: LEAGUE_B })).toBe(false);
    expect(can(a, "classification.override", { leagueId: LEAGUE_B })).toBe(false);
  });

  it("a coach holds no permission at another school (scenario 13)", () => {
    const c = coach("HEAD_COACH", SCHOOL_A);
    expect(can(c, "roster.edit", { schoolId: SCHOOL_A })).toBe(true);
    expect(can(c, "roster.edit", { schoolId: SCHOOL_B })).toBe(false);
    expect(can(c, "team.register", { schoolId: SCHOOL_B })).toBe(false);
  });

  it("denies any permission asked without a scope", () => {
    // A caller that forgets to pass leagueId must get a denial, never an
    // ambient yes. This is the guard against a whole class of mistake.
    const a = leagueAdmin("OWNER");
    expect(can(a, "league.configure", {})).toBe(false);
    expect(can(a, "school.approve", {})).toBe(false);
  });

  it("a user with no roles holds nothing", () => {
    const nobody = actor();
    expect(can(nobody, "report.view", { leagueId: LEAGUE_A })).toBe(false);
    expect(can(nobody, "roster.edit", { schoolId: SCHOOL_A })).toBe(false);
  });
});

// --- One user, two hats -----------------------------------------------

describe("a user holding roles at both levels", () => {
  // The brief's example: league admin for IEN and head coach at their own
  // school, on one account.
  const dualHat = actor({
    leagueRoles: [{ leagueId: LEAGUE_A, role: "ADMIN" }],
    schoolRoles: [{ schoolId: SCHOOL_A, role: "HEAD_COACH" }],
  });

  it("holds league permissions in their league", () => {
    expect(can(dualHat, "season.manage", { leagueId: LEAGUE_A })).toBe(true);
  });

  it("holds coach permissions at their school", () => {
    expect(can(dualHat, "team.register", { schoolId: SCHOOL_A })).toBe(true);
  });

  it("does not gain coach powers at other schools from being a league admin", () => {
    expect(can(dualHat, "roster.edit", { schoolId: SCHOOL_B })).toBe(false);
  });

  it("does not gain league powers from being a coach", () => {
    const justCoach = coach("HEAD_COACH");
    expect(can(justCoach, "school.approve", { leagueId: LEAGUE_A })).toBe(false);
  });
});

// --- Role separation --------------------------------------------------

describe("league role separation", () => {
  it("only the owner can manage league staff", () => {
    expect(can(leagueAdmin("OWNER"), "league.manageStaff", { leagueId: LEAGUE_A })).toBe(true);
    for (const role of [
      "ADMIN",
      "COMPETITION_DIRECTOR",
      "SCHOOL_SUPPORT",
      "GAME_MANAGER",
      "EVENT_ADMIN",
      "READ_ONLY",
    ] as LeagueRole[]) {
      expect(can(leagueAdmin(role), "league.manageStaff", { leagueId: LEAGUE_A })).toBe(false);
    }
  });

  it("READ_ONLY can view reports and nothing else", () => {
    expect(permissionsForLeagueRole("READ_ONLY")).toEqual(["report.view"]);
    const ro = leagueAdmin("READ_ONLY");
    const mutations: Permission[] = [
      "league.configure",
      "season.manage",
      "competition.create",
      "competition.publish",
      "school.approve",
      "classification.override",
      "registration.registerForSchool",
      "registration.approveLate",
      "schedule.manage",
      "match.resolve",
      "playoffs.manage",
    ];
    for (const p of mutations) {
      expect(can(ro, p, { leagueId: LEAGUE_A, competitionId: "c-1" })).toBe(false);
    }
  });

  it("SCHOOL_SUPPORT can approve schools but not configure the league", () => {
    const s = leagueAdmin("SCHOOL_SUPPORT");
    expect(can(s, "school.approve", { leagueId: LEAGUE_A })).toBe(true);
    expect(can(s, "registration.registerForSchool", { leagueId: LEAGUE_A })).toBe(true);
    expect(can(s, "league.configure", { leagueId: LEAGUE_A })).toBe(false);
    expect(can(s, "classification.override", { leagueId: LEAGUE_A })).toBe(false);
  });

  it("owners and admins can register for a member school without gaining roster edit access", () => {
    for (const role of ["OWNER", "ADMIN"] as LeagueRole[]) {
      const admin = leagueAdmin(role);
      expect(
        can(admin, "registration.registerForSchool", { leagueId: LEAGUE_A }),
      ).toBe(true);
      expect(can(admin, "roster.edit", { schoolId: SCHOOL_A })).toBe(false);
    }
  });
});

// --- Assignment narrowing ---------------------------------------------

describe("assignment narrows a role rather than widening it", () => {
  const director = actor({
    leagueRoles: [
      {
        leagueId: LEAGUE_A,
        role: "COMPETITION_DIRECTOR",
        competitionIds: ["comp-rl-1a"],
      },
    ],
  });

  it("grants within an assigned competition", () => {
    expect(can(director, "schedule.manage", { leagueId: LEAGUE_A, competitionId: "comp-rl-1a" })).toBe(true);
    expect(can(director, "match.resolve", { leagueId: LEAGUE_A, competitionId: "comp-rl-1a" })).toBe(true);
  });

  it("denies outside an assigned competition", () => {
    expect(can(director, "schedule.manage", { leagueId: LEAGUE_A, competitionId: "comp-rl-2a" })).toBe(false);
  });

  it("denies when no competition is named at all", () => {
    // "Can this director manage schedules generally?" has no safe yes.
    expect(can(director, "schedule.manage", { leagueId: LEAGUE_A })).toBe(false);
  });

  it("treats an empty assignment list as assigned to nothing", () => {
    const unassigned = actor({
      leagueRoles: [{ leagueId: LEAGUE_A, role: "COMPETITION_DIRECTOR", competitionIds: [] }],
    });
    expect(can(unassigned, "schedule.manage", { leagueId: LEAGUE_A, competitionId: "comp-rl-1a" })).toBe(false);
  });

  it("still grants unassigned-scoped permissions like report.view", () => {
    expect(can(director, "report.view", { leagueId: LEAGUE_A })).toBe(true);
  });

  it("narrows a game manager to their assigned titles", () => {
    const gm = actor({
      leagueRoles: [{ leagueId: LEAGUE_A, role: "GAME_MANAGER", gameTitleIds: ["game-rl"] }],
    });
    expect(can(gm, "match.resolve", { leagueId: LEAGUE_A, gameTitleId: "game-rl" })).toBe(true);
    expect(can(gm, "match.resolve", { leagueId: LEAGUE_A, gameTitleId: "game-valorant" })).toBe(false);
  });
});

// --- School roles (required scenario 16) ------------------------------

describe("school role policy", () => {
  it("head coaches can approve school staff; assistant coaches cannot (scenario 16)", () => {
    expect(can(coach("HEAD_COACH"), "schoolStaff.approve", { schoolId: SCHOOL_A })).toBe(true);
    expect(can(coach("ADDITIONAL_HEAD_COACH"), "schoolStaff.approve", { schoolId: SCHOOL_A })).toBe(true);
    expect(can(coach("SCHOOL_ADMIN"), "schoolStaff.approve", { schoolId: SCHOOL_A })).toBe(true);
    expect(can(coach("ASSISTANT_COACH"), "schoolStaff.approve", { schoolId: SCHOOL_A })).toBe(false);
    expect(can(coach("TEAM_COACH"), "schoolStaff.approve", { schoolId: SCHOOL_A })).toBe(false);
  });

  it("players hold no school permissions", () => {
    const player = coach("PLAYER");
    for (const p of ["team.register", "roster.edit", "match.report"] as Permission[]) {
      expect(can(player, p, { schoolId: SCHOOL_A })).toBe(false);
    }
  });

  it("only head coaches and school admins may request late registration", () => {
    expect(can(coach("HEAD_COACH"), "registration.requestLate", { schoolId: SCHOOL_A })).toBe(true);
    expect(can(coach("ASSISTANT_COACH"), "registration.requestLate", { schoolId: SCHOOL_A })).toBe(false);
  });

  it("limits a team coach to their own teams", () => {
    const teamCoach = actor({
      schoolRoles: [{ schoolId: SCHOOL_A, role: "TEAM_COACH", teamIds: ["team-rl-varsity"] }],
    });
    expect(can(teamCoach, "roster.edit", { schoolId: SCHOOL_A, teamId: "team-rl-varsity" })).toBe(true);
    expect(can(teamCoach, "roster.edit", { schoolId: SCHOOL_A, teamId: "team-smash-varsity" })).toBe(false);
    // No team in scope means the question can't be answered yes.
    expect(can(teamCoach, "roster.edit", { schoolId: SCHOOL_A })).toBe(false);
  });

  it("does not apply team narrowing to head coaches", () => {
    expect(can(coach("HEAD_COACH"), "roster.edit", { schoolId: SCHOOL_A, teamId: "any-team" })).toBe(true);
    expect(can(coach("HEAD_COACH"), "roster.edit", { schoolId: SCHOOL_A })).toBe(true);
  });
});

// --- assertCan --------------------------------------------------------

describe("assertCan", () => {
  it("throws a PermissionError naming the permission", () => {
    expect(() => assertCan(coach("PLAYER"), "roster.edit", { schoolId: SCHOOL_A })).toThrow(
      PermissionError,
    );
    try {
      assertCan(coach("PLAYER"), "roster.edit", { schoolId: SCHOOL_A });
    } catch (e) {
      expect((e as PermissionError).permission).toBe("roster.edit");
    }
  });

  it("does not throw when the permission is held", () => {
    expect(() => assertCan(coach("HEAD_COACH"), "roster.edit", { schoolId: SCHOOL_A })).not.toThrow();
  });
});
