/**
 * Competition eligibility — one decision function, used by everything.
 *
 * The audit found the same rules implemented twice: once in the coach
 * dashboard's data loader (deciding what a coach *sees*) and once in the
 * register server action (deciding what the server *allows*). They had already
 * drifted — the loader offered DRAFT competitions and skipped the agreement,
 * supported-game and coach-role checks the action enforced. A coach could see a
 * competition and then be refused for a reason the list never mentioned.
 *
 * That is the exact failure RIEL exists to eliminate, so this module is the
 * single answer both sides call. `evaluateEligibility` is pure — facts in,
 * decision out — which makes "what the UI shows" and "what the server allows"
 * the same computation by construction, not by discipline.
 *
 * Every branch returns a reason code, a human-readable message with the real
 * date or number in it, and the next action a coach can take. There is no
 * branch that returns a bare "no".
 */

export type SchoolPopulation = "HIGH_SCHOOL" | "MIDDLE_SCHOOL" | "UNIFIED";

export type EligibilityReason =
  | "ELIGIBLE"
  | "COMPETITION_NOT_PUBLISHED"
  | "WRONG_SCHOOL_POPULATION"
  | "WRONG_DIVISION"
  | "GAME_NOT_SUPPORTED"
  | "SCHOOL_NOT_VERIFIED"
  | "MISSING_CLASSIFICATION"
  | "SCHOOL_AGREEMENT_MISSING"
  | "COACH_NOT_AUTHORIZED"
  | "ALREADY_REGISTERED"
  | "REGISTRATION_NOT_OPEN"
  | "REGISTRATION_CLOSED"
  | "LATE_REGISTRATION_AVAILABLE"
  | "TEAM_LIMIT_REACHED";

export type EligibilityAction =
  | { kind: "REGISTER_TEAM"; competitionId: string }
  | { kind: "MANAGE_TEAM"; rosterId: string }
  | { kind: "REQUEST_LATE_REGISTRATION"; competitionId: string }
  | { kind: "VIEW_VERIFICATION_STATUS"; schoolId: string }
  | { kind: "ACCEPT_SCHOOL_AGREEMENT"; schoolId: string }
  | { kind: "REQUEST_ACCESS"; schoolId: string }
  | { kind: "NONE" };

export type EligibilityDecision = {
  /** True only when registration would actually succeed right now. */
  eligible: boolean;
  reason: EligibilityReason;
  /** Shown to the coach verbatim. Always specific — never "contact your league admin". */
  message: string;
  action: EligibilityAction;
  /**
   * Whether this competition belongs on the coach's screen at all.
   *
   * False means genuinely not applicable to this school — a middle school does
   * not need to be told why it can't enter a high-school 2A competition. Every
   * *other* refusal is visible, with its reason and next action, because an
   * absence a coach can't explain is the thing that generates support email.
   */
  visible: boolean;
};

export type EligibilityFacts = {
  now: Date;
  /**
   * IANA zone the league operates in, used to render dates in messages. A
   * deadline of "September 18" has to mean September 18 where the coach is,
   * and a platform that runs more than one league cannot assume Eastern.
   * Defaults to UTC when a league has not set one.
   */
  timeZone?: string;
  school: {
    id: string;
    name: string;
    /** ACTIVE league membership in the competition's league. */
    verifiedInLeague: boolean;
    /** School participation agreement accepted for this school. */
    agreementAccepted: boolean;
    population: SchoolPopulation | null;
    /** Effective division for the season, or null if the league doesn't divide this population. */
    divisionId: string | null;
    /** True when the league divides this population but no classification exists yet. */
    classificationMissing: boolean;
  };
  competition: {
    id: string;
    name: string;
    /** Published means state ACTIVE — a DRAFT competition is never offered. */
    published: boolean;
    /** COMPLETE competitions are closed to new registration. */
    finished: boolean;
    population: SchoolPopulation;
    /** null = open to every division of this population. */
    divisionId: string | null;
    gameSupported: boolean;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    lateRegistrationEnabled: boolean;
    /** null = no cap. */
    maxTeamsPerSchool: number | null;
  };
  actor: {
    /** Result of can(actor, "team.register", { schoolId }). */
    canRegister: boolean;
  };
  state: {
    /** Rosters this school already has in this competition. */
    registeredTeamCount: number;
    /** Set when the team being asked about is already registered. */
    existingRosterId: string | null;
    /** An APPROVED, unexpired late-registration exception for this school + competition. */
    hasApprovedLateRegistration: boolean;
    /** An APPROVED team-limit bypass for this school + competition. */
    hasApprovedTeamLimitBypass: boolean;
  };
};

function formatDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone });
}

const hidden = (reason: EligibilityReason, message: string): EligibilityDecision => ({
  eligible: false,
  reason,
  message,
  action: { kind: "NONE" },
  visible: false,
});

/**
 * Decide whether a school may register a team for a competition right now.
 *
 * Check order is deliberate. Structural non-applicability comes first (so a
 * middle school is never shown high-school competitions), then school standing,
 * then the actor, then timing, then limits. Within the visible refusals the
 * order runs from "furthest from being fixable" to "closest", so the message a
 * coach sees is the one they can act on soonest.
 */
export function evaluateEligibility(facts: EligibilityFacts): EligibilityDecision {
  const { now, school, competition, actor, state } = facts;
  const timeZone = facts.timeZone ?? "UTC";

  // --- 1. Structural: not this school's competition at all --------------

  if (!competition.published) {
    // The old dashboard loader offered DRAFT competitions to coaches. It should
    // never have; an admin still building a competition has not opened it.
    return hidden(
      "COMPETITION_NOT_PUBLISHED",
      `${competition.name} has not been published yet.`,
    );
  }

  if (school.population !== null && school.population !== competition.population) {
    return hidden(
      "WRONG_SCHOOL_POPULATION",
      `${competition.name} is for ${labelPopulation(competition.population)} programs.`,
    );
  }

  if (!competition.gameSupported) {
    return hidden(
      "GAME_NOT_SUPPORTED",
      `${competition.name} uses a game that is no longer open for new registrations.`,
    );
  }

  // --- 2. School standing in the league ---------------------------------

  if (!school.verifiedInLeague) {
    return {
      eligible: false,
      reason: "SCHOOL_NOT_VERIFIED",
      message: `${school.name}'s league verification is still pending.`,
      action: { kind: "VIEW_VERIFICATION_STATUS", schoolId: school.id },
      visible: true,
    };
  }

  // Division is checked after verification, because an unverified school has no
  // classification yet and "wrong division" would be a misleading answer.
  if (competition.divisionId !== null) {
    if (school.classificationMissing || school.divisionId === null) {
      return {
        eligible: false,
        reason: "MISSING_CLASSIFICATION",
        message:
          `${school.name} does not have a division for this season yet, so RIEL can't tell ` +
          `whether it belongs in ${competition.name}. The league is notified.`,
        action: { kind: "NONE" },
        visible: true,
      };
    }
    if (school.divisionId !== competition.divisionId) {
      return hidden(
        "WRONG_DIVISION",
        `${competition.name} is for a different division.`,
      );
    }
  }

  // --- 3. Already in it -------------------------------------------------

  if (state.existingRosterId !== null) {
    return {
      eligible: false,
      reason: "ALREADY_REGISTERED",
      message: `This team is already registered for ${competition.name}.`,
      action: { kind: "MANAGE_TEAM", rosterId: state.existingRosterId },
      visible: true,
    };
  }

  // --- 4. The person asking ---------------------------------------------

  if (!actor.canRegister) {
    return {
      eligible: false,
      reason: "COACH_NOT_AUTHORIZED",
      message: `You need Head Coach or Team Coach permission at ${school.name} to register a team.`,
      action: { kind: "REQUEST_ACCESS", schoolId: school.id },
      visible: true,
    };
  }

  if (!school.agreementAccepted) {
    return {
      eligible: false,
      reason: "SCHOOL_AGREEMENT_MISSING",
      message: `${school.name} has to accept the school participation agreement before registering teams.`,
      action: { kind: "ACCEPT_SCHOOL_AGREEMENT", schoolId: school.id },
      visible: true,
    };
  }

  // --- 5. Timing ---------------------------------------------------------

  const { registrationOpensAt, registrationClosesAt } = competition;

  if (registrationOpensAt !== null && now < registrationOpensAt) {
    return {
      eligible: false,
      reason: "REGISTRATION_NOT_OPEN",
      message: `Registration for ${competition.name} opens ${formatDate(registrationOpensAt, timeZone)}.`,
      action: { kind: "NONE" },
      visible: true,
    };
  }

  // A finished competition is closed to everyone. This is checked before the
  // late-registration exception, because an approved exception is permission to
  // miss a deadline — not permission to enter a competition that has already
  // been played.
  if (competition.finished) {
    return {
      eligible: false,
      reason: "REGISTRATION_CLOSED",
      message: `${competition.name} has finished.`,
      action: { kind: "NONE" },
      visible: true,
    };
  }

  const closed = registrationClosesAt !== null && now > registrationClosesAt;

  if (closed && !state.hasApprovedLateRegistration) {
    const closedOn = registrationClosesAt !== null ? ` ${formatDate(registrationClosesAt, timeZone)}` : "";
    if (competition.lateRegistrationEnabled) {
      return {
        eligible: false,
        reason: "LATE_REGISTRATION_AVAILABLE",
        message: `Registration closed${closedOn}. You can ask the league to let this team in late.`,
        action: { kind: "REQUEST_LATE_REGISTRATION", competitionId: competition.id },
        visible: true,
      };
    }
    return {
      eligible: false,
      reason: "REGISTRATION_CLOSED",
      message: `Registration for ${competition.name} closed${closedOn}.`,
      action: { kind: "NONE" },
      visible: true,
    };
  }

  // --- 6. Limits ---------------------------------------------------------

  const { maxTeamsPerSchool } = competition;
  if (
    maxTeamsPerSchool !== null &&
    state.registeredTeamCount >= maxTeamsPerSchool &&
    !state.hasApprovedTeamLimitBypass
  ) {
    return {
      eligible: false,
      reason: "TEAM_LIMIT_REACHED",
      message:
        `${competition.name} allows ${maxTeamsPerSchool} team${maxTeamsPerSchool === 1 ? "" : "s"} ` +
        `per school, and ${school.name} has ${state.registeredTeamCount}.`,
      action: { kind: "NONE" },
      visible: true,
    };
  }

  // --- 7. Yes -------------------------------------------------------------

  return {
    eligible: true,
    reason: "ELIGIBLE",
    message: registrationClosesAt
      ? `Registration closes ${formatDate(registrationClosesAt, timeZone)}.`
      : "Registration is open.",
    action: { kind: "REGISTER_TEAM", competitionId: competition.id },
    visible: true,
  };
}

function labelPopulation(population: SchoolPopulation): string {
  switch (population) {
    case "HIGH_SCHOOL":
      return "high school";
    case "MIDDLE_SCHOOL":
      return "middle school";
    case "UNIFIED":
      return "Unified";
  }
}
