import { describe, expect, it } from "vitest";

import {
  evaluateTeamCompetitionEligibility,
  schoolPopulations,
} from "./team-competition";

const now = new Date("2026-09-07T12:00:00.000Z");
const opens = new Date("2026-09-01T12:00:00.000Z");
const closes = new Date("2026-09-18T23:59:59.000Z");

describe("team competition eligibility adapter", () => {
  it("turns a matching active 1A competition into a register decision", () => {
    const decision = evaluateTeamCompetitionEligibility(facts());

    expect(decision.eligible).toBe(true);
    expect(decision.visible).toBe(true);
    expect(decision.action).toEqual({ kind: "REGISTER_TEAM", competitionId: "comp-1" });
  });

  it("never offers draft competitions to a coach", () => {
    const decision = evaluateTeamCompetitionEligibility(
      facts({ competition: { state: "DRAFT" } }),
    );

    expect(decision.eligible).toBe(false);
    expect(decision.visible).toBe(false);
    expect(decision.reason).toBe("COMPETITION_NOT_PUBLISHED");
  });

  it("shows a missing classification instead of hiding a divided competition", () => {
    const decision = evaluateTeamCompetitionEligibility(
      facts({
        school: { divisionId: null, classificationMissing: true },
      }),
    );

    expect(decision.eligible).toBe(false);
    expect(decision.visible).toBe(true);
    expect(decision.reason).toBe("MISSING_CLASSIFICATION");
  });

  it("derives both high-school and middle-school populations from a 7-12 grade span", () => {
    expect(schoolPopulations({ level: "OTHER", lowGrade: "07", highGrade: "12" })).toEqual([
      "HIGH_SCHOOL",
      "MIDDLE_SCHOOL",
      "UNIFIED",
    ]);
  });
});

function facts(overrides: {
  school?: Partial<Parameters<typeof evaluateTeamCompetitionEligibility>[0]["school"]>;
  competition?: Partial<Parameters<typeof evaluateTeamCompetitionEligibility>[0]["competition"]>;
} = {}) {
  return {
    now,
    school: {
      id: "school-1",
      name: "Example High School",
      level: "HIGH" as const,
      lowGrade: "09",
      highGrade: "12",
      verifiedInLeague: true,
      agreementAccepted: true,
      divisionId: "div-1a",
      classificationMissing: false,
      ...overrides.school,
    },
    team: {
      id: "team-1",
      gameTitleId: "game-rl",
      skillTier: "VARSITY" as const,
    },
    competition: {
      id: "comp-1",
      name: "Rocket League Varsity 1A",
      gameTitleId: "game-rl",
      gameSlug: "rl",
      skillTier: "VARSITY" as const,
      state: "ACTIVE" as const,
      status: "SEEDING" as const,
      divisionId: "div-1a",
      registrationOpensAt: opens,
      registrationClosesAt: closes,
      ...overrides.competition,
    },
    actor: { canRegister: true },
    state: {
      registeredTeamCount: 0,
      existingRosterId: null,
    },
  };
}
