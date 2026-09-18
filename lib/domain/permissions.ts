/**
 * Authorization — one declarative matrix, one `can()` call.
 *
 * Pure by design: no Prisma, no env, no React. Callers resolve an `Actor` from
 * the database once, then ask this module questions. That keeps authorization
 * out of individual server actions, where it drifted before, and makes the
 * whole matrix testable without a database.
 *
 * Two rules that the rest of the app depends on:
 *
 *   1. **Scope is mandatory.** A league permission is granted only when the
 *      actor holds a role in *that* league; a school permission only when they
 *      hold a role at *that* school. There is no ambient "is an admin"
 *      question to ask, which is what makes cross-tenant access structurally
 *      impossible rather than merely unlikely.
 *
 *   2. **Assignment narrows, never widens.** A Competition Director or Game
 *      Manager holds a permission only within their assigned competitions or
 *      game titles. An empty assignment list means "assigned to nothing", not
 *      "assigned to everything" — the safe reading.
 */

export type LeagueRole =
  | "OWNER"
  | "ADMIN"
  | "COMPETITION_DIRECTOR"
  | "SCHOOL_SUPPORT"
  | "GAME_MANAGER"
  | "EVENT_ADMIN"
  | "READ_ONLY";

export type SchoolRole =
  | "HEAD_COACH"
  | "ADDITIONAL_HEAD_COACH"
  | "ASSISTANT_COACH"
  | "TEAM_COACH"
  | "SCHOOL_ADMIN"
  | "PLAYER";

export type Permission =
  // League configuration
  | "league.configure"
  | "league.manageStaff"
  | "season.manage"
  | "competition.create"
  | "competition.publish"
  // School and coach administration
  | "school.approve"
  | "classification.override"
  | "registration.registerForSchool"
  | "registration.approveLate"
  | "registration.approveRoster"
  // Competition operations
  | "schedule.manage"
  | "match.resolve"
  | "playoffs.manage"
  | "report.view"
  // School-side actions
  | "team.register"
  | "roster.edit"
  | "match.report"
  | "registration.requestLate"
  | "schoolStaff.approve";

/**
 * Permissions that are narrowed by competition assignment. A role holding one
 * of these through an assignment-scoped grant must be assigned the competition
 * being acted on.
 */
const COMPETITION_SCOPED: ReadonlySet<Permission> = new Set([
  "competition.publish",
  "registration.approveLate",
  "registration.approveRoster",
  "schedule.manage",
  "match.resolve",
  "playoffs.manage",
]);

/** Permissions narrowed by game-title assignment (Game Manager). */
const GAME_SCOPED: ReadonlySet<Permission> = new Set(["schedule.manage", "match.resolve"]);

type Grant = {
  permission: Permission;
  /** When true, the grant applies only within the role's assigned competitions. */
  requiresCompetitionAssignment?: boolean;
  /** When true, the grant applies only within the role's assigned game titles. */
  requiresGameAssignment?: boolean;
};

const LEAGUE_MATRIX: Record<LeagueRole, Grant[]> = {
  OWNER: [
    { permission: "league.configure" },
    { permission: "league.manageStaff" },
    { permission: "season.manage" },
    { permission: "competition.create" },
    { permission: "competition.publish" },
    { permission: "school.approve" },
    { permission: "classification.override" },
    { permission: "registration.registerForSchool" },
    { permission: "registration.approveLate" },
    { permission: "registration.approveRoster" },
    { permission: "schedule.manage" },
    { permission: "match.resolve" },
    { permission: "playoffs.manage" },
    { permission: "report.view" },
  ],
  // Everything the owner can do except changing who the league's staff are.
  ADMIN: [
    { permission: "league.configure" },
    { permission: "season.manage" },
    { permission: "competition.create" },
    { permission: "competition.publish" },
    { permission: "school.approve" },
    { permission: "classification.override" },
    { permission: "registration.registerForSchool" },
    { permission: "registration.approveLate" },
    { permission: "registration.approveRoster" },
    { permission: "schedule.manage" },
    { permission: "match.resolve" },
    { permission: "playoffs.manage" },
    { permission: "report.view" },
  ],
  COMPETITION_DIRECTOR: [
    { permission: "competition.publish", requiresCompetitionAssignment: true },
    { permission: "registration.approveLate", requiresCompetitionAssignment: true },
    { permission: "registration.approveRoster", requiresCompetitionAssignment: true },
    { permission: "schedule.manage", requiresCompetitionAssignment: true },
    { permission: "match.resolve", requiresCompetitionAssignment: true },
    { permission: "playoffs.manage", requiresCompetitionAssignment: true },
    { permission: "report.view" },
  ],
  SCHOOL_SUPPORT: [
    { permission: "school.approve" },
    { permission: "registration.registerForSchool" },
    { permission: "registration.approveLate" },
    { permission: "registration.approveRoster" },
    { permission: "report.view" },
  ],
  GAME_MANAGER: [
    { permission: "schedule.manage", requiresGameAssignment: true },
    { permission: "match.resolve", requiresGameAssignment: true },
    { permission: "report.view" },
  ],
  EVENT_ADMIN: [
    { permission: "schedule.manage" },
    { permission: "match.resolve" },
    { permission: "playoffs.manage" },
    { permission: "report.view" },
  ],
  READ_ONLY: [{ permission: "report.view" }],
};

const SCHOOL_MATRIX: Record<SchoolRole, Permission[]> = {
  HEAD_COACH: [
    "team.register",
    "roster.edit",
    "match.report",
    "registration.requestLate",
    "schoolStaff.approve",
  ],
  ADDITIONAL_HEAD_COACH: [
    "team.register",
    "roster.edit",
    "match.report",
    "registration.requestLate",
    "schoolStaff.approve",
  ],
  ASSISTANT_COACH: ["team.register", "roster.edit", "match.report"],
  // Team Coach holds the same actions but only for their own teams; the team
  // narrowing is applied in `can()`, not here.
  TEAM_COACH: ["team.register", "roster.edit", "match.report"],
  SCHOOL_ADMIN: [
    "team.register",
    "roster.edit",
    "registration.requestLate",
    "schoolStaff.approve",
  ],
  PLAYER: [],
};

/** Roles whose school-side grants apply only to teams they are assigned to. */
const TEAM_SCOPED_ROLES: ReadonlySet<SchoolRole> = new Set(["TEAM_COACH"]);

export type LeagueRoleAssignment = {
  leagueId: string;
  role: LeagueRole;
  /** Competitions this role is assigned to. Empty/undefined = assigned to none. */
  competitionIds?: string[];
  /** Game titles this role is assigned to. Empty/undefined = assigned to none. */
  gameTitleIds?: string[];
};

export type SchoolRoleAssignment = {
  schoolId: string;
  role: SchoolRole;
  /** Teams this role is limited to. Only meaningful for team-scoped roles. */
  teamIds?: string[];
};

export type Actor = {
  userId: string;
  leagueRoles: LeagueRoleAssignment[];
  schoolRoles: SchoolRoleAssignment[];
};

export type Scope = {
  leagueId?: string;
  schoolId?: string;
  competitionId?: string;
  gameTitleId?: string;
  teamId?: string;
};

function grantApplies(
  grant: Grant,
  assignment: LeagueRoleAssignment,
  scope: Scope,
): boolean {
  if (grant.requiresCompetitionAssignment && COMPETITION_SCOPED.has(grant.permission)) {
    if (!scope.competitionId) return false;
    if (!assignment.competitionIds?.includes(scope.competitionId)) return false;
  }
  if (grant.requiresGameAssignment && GAME_SCOPED.has(grant.permission)) {
    if (!scope.gameTitleId) return false;
    if (!assignment.gameTitleIds?.includes(scope.gameTitleId)) return false;
  }
  return true;
}

/**
 * Does this actor hold `permission` within `scope`?
 *
 * Returns false whenever the scope needed to answer is absent — an unscoped
 * question is never granted. That is deliberate: a caller that forgets to pass
 * `leagueId` gets a denial, not a league-wide yes.
 */
export function can(actor: Actor, permission: Permission, scope: Scope): boolean {
  // --- League-side ------------------------------------------------------
  if (scope.leagueId) {
    for (const assignment of actor.leagueRoles) {
      if (assignment.leagueId !== scope.leagueId) continue;
      for (const grant of LEAGUE_MATRIX[assignment.role]) {
        if (grant.permission !== permission) continue;
        if (grantApplies(grant, assignment, scope)) return true;
      }
    }
  }

  // --- School-side ------------------------------------------------------
  if (scope.schoolId) {
    for (const assignment of actor.schoolRoles) {
      if (assignment.schoolId !== scope.schoolId) continue;
      if (!SCHOOL_MATRIX[assignment.role].includes(permission)) continue;
      if (TEAM_SCOPED_ROLES.has(assignment.role)) {
        // A team-scoped role must be acting on one of its own teams. A
        // question with no team in scope cannot be answered "yes".
        if (!scope.teamId) return false;
        if (!assignment.teamIds?.includes(scope.teamId)) return false;
      }
      return true;
    }
  }

  return false;
}

/** Convenience for call sites that want to fail loudly. */
export class PermissionError extends Error {
  constructor(
    readonly permission: Permission,
    readonly scope: Scope,
  ) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}

export function assertCan(actor: Actor, permission: Permission, scope: Scope): void {
  if (!can(actor, permission, scope)) throw new PermissionError(permission, scope);
}

/** Every permission a role grants, ignoring assignment narrowing. Used by the docs page and tests. */
export function permissionsForLeagueRole(role: LeagueRole): Permission[] {
  return LEAGUE_MATRIX[role].map((g) => g.permission);
}

export function permissionsForSchoolRole(role: SchoolRole): Permission[] {
  return [...SCHOOL_MATRIX[role]];
}
