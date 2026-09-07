import { describe, expect, it } from "vitest";

import {
  evaluateEligibility,
  type EligibilityDecision,
  type EligibilityFacts,
} from "./eligibility";

// --- Fixtures ----------------------------------------------------------

const NOW = new Date("2026-09-07T12:00:00Z");
const OPENS = new Date("2026-09-01T12:00:00Z");
const CLOSES = new Date("2026-09-18T23:59:59Z");

/** A verified 1A high school, authorized head coach, registration open. */
function facts(over: DeepPartial<EligibilityFacts> = {}): EligibilityFacts {
  const base: EligibilityFacts = {
    now: NOW,
    timeZone: "America/New_York",
    school: {
      id: "school-1",
      name: "Example High School",
      verifiedInLeague: true,
      agreementAccepted: true,
      population: "HIGH_SCHOOL",
      divisionId: "div-1a",
      classificationMissing: false,
    },
    competition: {
      id: "comp-1",
      name: "Rocket League Varsity - 1A",
      published: true,
      finished: false,
      population: "HIGH_SCHOOL",
      divisionId: "div-1a",
      gameSupported: true,
      registrationOpensAt: OPENS,
      registrationClosesAt: CLOSES,
      lateRegistrationEnabled: false,
      maxTeamsPerSchool: null,
    },
    actor: { canRegister: true },
    state: {
      registeredTeamCount: 0,
      existingRosterId: null,
      hasApprovedLateRegistration: false,
      hasApprovedTeamLimitBypass: false,
    },
  };
  return merge(base, over);
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T>(base: T, over: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      out[k] = merge((base as Record<string, unknown>)[k], v as never);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

// --- Required scenarios 9, 10, 11, 12 ---------------------------------

describe("the happy path (scenario 10)", () => {
  it("lets an eligible school register", () => {
    const d = evaluateEligibility(facts());
    expect(d.eligible).toBe(true);
    expect(d.reason).toBe("ELIGIBLE");
    expect(d.action).toEqual({ kind: "REGISTER_TEAM", competitionId: "comp-1" });
    expect(d.visible).toBe(true);
  });

  it("tells the coach when registration closes", () => {
    expect(evaluateEligibility(facts()).message).toContain("September 18");
  });
});

describe("ineligible schools (scenario 9)", () => {
  it("refuses an unverified school and points at its verification status", () => {
    const d = evaluateEligibility(facts({ school: { verifiedInLeague: false } }));
    expect(d.eligible).toBe(false);
    expect(d.reason).toBe("SCHOOL_NOT_VERIFIED");
    expect(d.action.kind).toBe("VIEW_VERIFICATION_STATUS");
    expect(d.visible).toBe(true);
  });

  it("hides a competition for a different school population", () => {
    const d = evaluateEligibility(facts({ school: { population: "MIDDLE_SCHOOL" } }));
    expect(d.eligible).toBe(false);
    expect(d.reason).toBe("WRONG_SCHOOL_POPULATION");
    // A middle school does not need to be told why it can't enter 2A varsity.
    expect(d.visible).toBe(false);
  });

  it("hides a competition for a different division", () => {
    const d = evaluateEligibility(facts({ school: { divisionId: "div-2a" } }));
    expect(d.reason).toBe("WRONG_DIVISION");
    expect(d.visible).toBe(false);
  });

  it("shows an unclassified school why it is stuck, rather than hiding the competition", () => {
    const d = evaluateEligibility(
      facts({ school: { divisionId: null, classificationMissing: true } }),
    );
    expect(d.reason).toBe("MISSING_CLASSIFICATION");
    expect(d.visible).toBe(true);
    expect(d.message).toContain("division");
  });

  it("refuses an unauthorized coach with a way to ask for access", () => {
    const d = evaluateEligibility(facts({ actor: { canRegister: false } }));
    expect(d.reason).toBe("COACH_NOT_AUTHORIZED");
    expect(d.action).toEqual({ kind: "REQUEST_ACCESS", schoolId: "school-1" });
  });

  it("refuses when the school agreement is unsigned, and links to signing it", () => {
    const d = evaluateEligibility(facts({ school: { agreementAccepted: false } }));
    expect(d.reason).toBe("SCHOOL_AGREEMENT_MISSING");
    expect(d.action.kind).toBe("ACCEPT_SCHOOL_AGREEMENT");
  });

  it("hides a competition whose game is no longer supported", () => {
    const d = evaluateEligibility(facts({ competition: { gameSupported: false } }));
    expect(d.reason).toBe("GAME_NOT_SUPPORTED");
    expect(d.visible).toBe(false);
  });
});

describe("registration deadlines (scenario 11)", () => {
  it("refuses before registration opens, naming the date", () => {
    const d = evaluateEligibility({ ...facts(), now: new Date("2026-08-20T12:00:00Z") });
    expect(d.reason).toBe("REGISTRATION_NOT_OPEN");
    expect(d.message).toContain("September 1");
  });

  it("refuses after registration closes, naming the date", () => {
    const d = evaluateEligibility({ ...facts(), now: new Date("2026-09-25T12:00:00Z") });
    expect(d.reason).toBe("REGISTRATION_CLOSED");
    expect(d.message).toContain("September 18");
  });

  it("allows registration on the closing day", () => {
    const d = evaluateEligibility({ ...facts(), now: new Date("2026-09-18T20:00:00Z") });
    expect(d.eligible).toBe(true);
  });

  it("refuses a finished competition", () => {
    const d = evaluateEligibility(facts({ competition: { finished: true } }));
    expect(d.reason).toBe("REGISTRATION_CLOSED");
    expect(d.message).toContain("finished");
  });
});

describe("late registration (scenario 12)", () => {
  const afterClose = { ...facts(), now: new Date("2026-09-25T12:00:00Z") };

  it("offers a late-registration request when the league permits it", () => {
    const d = evaluateEligibility(
      merge(afterClose, { competition: { lateRegistrationEnabled: true } }),
    );
    expect(d.eligible).toBe(false);
    expect(d.reason).toBe("LATE_REGISTRATION_AVAILABLE");
    expect(d.action).toEqual({ kind: "REQUEST_LATE_REGISTRATION", competitionId: "comp-1" });
    expect(d.message).toContain("September 18");
  });

  it("does not offer it when the league has not enabled it", () => {
    expect(evaluateEligibility(afterClose).reason).toBe("REGISTRATION_CLOSED");
  });

  it("an approved exception makes a closed competition registerable", () => {
    const d = evaluateEligibility(
      merge(afterClose, {
        competition: { lateRegistrationEnabled: true },
        state: { hasApprovedLateRegistration: true },
      }),
    );
    expect(d.eligible).toBe(true);
    expect(d.action.kind).toBe("REGISTER_TEAM");
  });

  it("an approved exception does not resurrect a finished competition", () => {
    const d = evaluateEligibility(
      merge(afterClose, {
        competition: { finished: true, lateRegistrationEnabled: true },
        state: { hasApprovedLateRegistration: true },
      }),
    );
    // hasApprovedLateRegistration short-circuits the closed check, so a
    // finished competition must be caught another way. Assert the behaviour we
    // want rather than the one that falls out.
    expect(d.eligible).toBe(false);
  });
});

describe("team limits", () => {
  it("refuses past the per-school cap and says what the cap is", () => {
    const d = evaluateEligibility(
      facts({ competition: { maxTeamsPerSchool: 2 }, state: { registeredTeamCount: 2 } }),
    );
    expect(d.reason).toBe("TEAM_LIMIT_REACHED");
    expect(d.message).toContain("2 teams");
  });

  it("allows registration below the cap", () => {
    const d = evaluateEligibility(
      facts({ competition: { maxTeamsPerSchool: 2 }, state: { registeredTeamCount: 1 } }),
    );
    expect(d.eligible).toBe(true);
  });

  it("an approved bypass overrides the cap", () => {
    const d = evaluateEligibility(
      facts({
        competition: { maxTeamsPerSchool: 1 },
        state: { registeredTeamCount: 1, hasApprovedTeamLimitBypass: true },
      }),
    );
    expect(d.eligible).toBe(true);
  });
});

describe("already registered", () => {
  it("points at the existing roster instead of offering to register again", () => {
    const d = evaluateEligibility(facts({ state: { existingRosterId: "roster-9" } }));
    expect(d.reason).toBe("ALREADY_REGISTERED");
    expect(d.action).toEqual({ kind: "MANAGE_TEAM", rosterId: "roster-9" });
    expect(d.visible).toBe(true);
  });
});

// --- Regression tests for the drift the audit found -------------------

describe("draft competitions are never offered (audit regression)", () => {
  it("hides an unpublished competition", () => {
    const d = evaluateEligibility(facts({ competition: { published: false } }));
    expect(d.eligible).toBe(false);
    expect(d.reason).toBe("COMPETITION_NOT_PUBLISHED");
    expect(d.visible).toBe(false);
  });

  it("hides it even for a fully eligible school with an authorized coach", () => {
    // The old dashboard loader allowed state DRAFT through; an otherwise
    // perfect school must still not see it.
    const d = evaluateEligibility(facts({ competition: { published: false } }));
    expect(d.visible).toBe(false);
  });
});

describe("visibility and enforcement cannot disagree (audit regression, test 18)", () => {
  // The whole point of one shared function: whatever a coach is shown is
  // computed by the same call that decides whether the server allows it.
  // Sweeping the fact space and asserting the invariant is what stops the two
  // sides drifting apart again.
  const toggles = [
    { path: "school.verifiedInLeague", values: [true, false] },
    { path: "school.agreementAccepted", values: [true, false] },
    { path: "actor.canRegister", values: [true, false] },
    { path: "competition.published", values: [true, false] },
    { path: "competition.gameSupported", values: [true, false] },
    { path: "competition.finished", values: [true, false] },
  ] as const;

  function set(target: EligibilityFacts, path: string, value: unknown): EligibilityFacts {
    const [group, key] = path.split(".");
    return merge(target, { [group]: { [key]: value } } as DeepPartial<EligibilityFacts>);
  }

  const combos: EligibilityFacts[] = [];
  const total = 2 ** toggles.length;
  for (let mask = 0; mask < total; mask++) {
    let f = facts();
    toggles.forEach((t, i) => {
      f = set(f, t.path, t.values[(mask >> i) & 1]);
    });
    combos.push(f);
  }

  it("covers the whole toggle space", () => {
    expect(combos).toHaveLength(64);
  });

  it("an invisible competition is never eligible", () => {
    for (const f of combos) {
      const d = evaluateEligibility(f);
      if (!d.visible) expect(d.eligible).toBe(false);
    }
  });

  it("an eligible decision is always visible and always offers REGISTER_TEAM", () => {
    for (const f of combos) {
      const d = evaluateEligibility(f);
      if (d.eligible) {
        expect(d.visible).toBe(true);
        expect(d.action.kind).toBe("REGISTER_TEAM");
        expect(d.reason).toBe("ELIGIBLE");
      }
    }
  });

  it("never returns eligible when any hard gate is closed", () => {
    for (const f of combos) {
      const d = evaluateEligibility(f);
      const hardGateClosed =
        !f.school.verifiedInLeague ||
        !f.school.agreementAccepted ||
        !f.actor.canRegister ||
        !f.competition.published ||
        !f.competition.gameSupported ||
        f.competition.finished;
      if (hardGateClosed) expect(d.eligible).toBe(false);
    }
  });
});

describe("every decision is actionable", () => {
  it("never returns an empty message", () => {
    const cases: EligibilityDecision[] = [
      evaluateEligibility(facts()),
      evaluateEligibility(facts({ school: { verifiedInLeague: false } })),
      evaluateEligibility(facts({ actor: { canRegister: false } })),
      evaluateEligibility(facts({ school: { agreementAccepted: false } })),
      evaluateEligibility(facts({ competition: { maxTeamsPerSchool: 1 }, state: { registeredTeamCount: 1 } })),
      evaluateEligibility({ ...facts(), now: new Date("2026-09-25T12:00:00Z") }),
      evaluateEligibility(facts({ state: { existingRosterId: "r-1" } })),
    ];
    for (const d of cases) {
      expect(d.message.trim().length).toBeGreaterThan(10);
      expect(d.message).not.toMatch(/contact (the )?league admin/i);
    }
  });

  it("gives every visible refusal either an action or a date to wait for", () => {
    const notOpen = evaluateEligibility({ ...facts(), now: new Date("2026-08-01T12:00:00Z") });
    expect(notOpen.action.kind).toBe("NONE");
    // A NONE action is only acceptable when the message itself tells the coach
    // what happens next — here, the date registration opens.
    expect(notOpen.message).toMatch(/September|October|opens/);
  });
});
