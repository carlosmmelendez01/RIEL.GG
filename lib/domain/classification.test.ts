import { describe, expect, it } from "vitest";

import {
  classifySchool,
  type DivisionRule,
  type EnrollmentRecord,
  type SchoolLevel,
} from "./classification";

// --- Fixtures ----------------------------------------------------------
//
// These mirror the Indiana Esports Network's current rules, but note that
// nothing in classification.ts knows that. The 900/901 boundary lives here,
// in test data, exactly as it will live in DivisionRule rows in the database.

const SEASON_START = new Date("2026-08-01T00:00:00Z");

function rule(over: Partial<DivisionRule> & Pick<DivisionRule, "id" | "schoolLevel">): DivisionRule {
  return {
    divisionId: null,
    divisionName: null,
    minimumEnrollment: null,
    maximumEnrollment: null,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: null,
    ...over,
  };
}

const IEN_RULES: DivisionRule[] = [
  rule({
    id: "r-1a",
    schoolLevel: "HIGH",
    divisionId: "div-1a",
    divisionName: "1A",
    minimumEnrollment: 0,
    maximumEnrollment: 900,
  }),
  rule({
    id: "r-2a",
    schoolLevel: "HIGH",
    divisionId: "div-2a",
    divisionName: "2A",
    minimumEnrollment: 901,
    maximumEnrollment: null,
  }),
  // Middle school: one unbounded rule with a null division. No enrollment needed.
  rule({ id: "r-ms", schoolLevel: "MIDDLE", divisionId: null, divisionName: null }),
];

function enrollment(count: number, over: Partial<EnrollmentRecord> = {}): EnrollmentRecord {
  return {
    id: "enr-1",
    schoolYear: "2024-25",
    enrollment: count,
    scope: "GRADES_9_12",
    sourceLabel: "CCD 2024-25 v.1a",
    ...over,
  };
}

function classify(level: SchoolLevel | null, enr: EnrollmentRecord | null, rules = IEN_RULES) {
  return classifySchool({
    schoolName: "Example High School",
    schoolLevel: level,
    enrollment: enr,
    rules,
    asOf: SEASON_START,
  });
}

// --- Required scenarios 4, 5, 6 ---------------------------------------

describe("IEN division rules", () => {
  it("classifies a 900-enrollment high school as 1A (scenario 4)", () => {
    const result = classify("HIGH", enrollment(900));
    expect(result.status).toBe("CLASSIFIED");
    expect(result.divisionName).toBe("1A");
    expect(result.matchedRuleId).toBe("r-1a");
  });

  it("classifies a 901-enrollment high school as 2A (scenario 5)", () => {
    const result = classify("HIGH", enrollment(901));
    expect(result.status).toBe("CLASSIFIED");
    expect(result.divisionName).toBe("2A");
    expect(result.matchedRuleId).toBe("r-2a");
  });

  it("gives a middle school no division (scenario 6)", () => {
    const result = classify("MIDDLE", null);
    expect(result.status).toBe("NO_DIVISION");
    expect(result.divisionId).toBeNull();
  });

  it("does not require enrollment to classify a middle school", () => {
    // The middle-school rule is unbounded, so a school with no enrollment
    // record still resolves cleanly instead of stalling on missing data.
    const result = classify("MIDDLE", null);
    expect(result.status).not.toBe("MISSING_ENROLLMENT");
  });
});

describe("boundary behaviour", () => {
  it.each([
    [0, "1A"],
    [1, "1A"],
    [876, "1A"],
    [899, "1A"],
    [900, "1A"],
    [901, "2A"],
    [902, "2A"],
    [1124, "2A"],
    [25000, "2A"],
  ])("enrollment %i resolves to %s", (count, expected) => {
    expect(classify("HIGH", enrollment(count)).divisionName).toBe(expected);
  });
});

// --- Failure branches -------------------------------------------------
//
// Every one of these must produce an explanation a coach or admin can act on.
// A bare status code with no message is the failure mode this whole module
// exists to prevent.

describe("when classification cannot happen", () => {
  it("reports missing enrollment rather than guessing", () => {
    const result = classify("HIGH", null);
    expect(result.status).toBe("MISSING_ENROLLMENT");
    expect(result.divisionId).toBeNull();
    expect(result.explanation).toMatch(/grades 9-12 enrollment/);
  });

  it("reports a missing school level", () => {
    const result = classify(null, enrollment(500));
    expect(result.status).toBe("MISSING_SCHOOL_LEVEL");
  });

  it("rejects an enrollment figure of the wrong scope", () => {
    // A league classifying on grades 9-12 must not silently fall back to a
    // total-enrollment figure — that is exactly how a 7-12 building gets
    // pushed into the wrong division.
    const result = classify("HIGH", enrollment(950, { scope: "TOTAL" }));
    expect(result.status).toBe("ENROLLMENT_SCOPE_MISMATCH");
    expect(result.divisionId).toBeNull();
  });

  it("reports a gap in the rules instead of picking a division", () => {
    const gapped = [
      rule({
        id: "r-low",
        schoolLevel: "HIGH",
        divisionId: "div-1a",
        divisionName: "1A",
        minimumEnrollment: 0,
        maximumEnrollment: 500,
      }),
      rule({
        id: "r-high",
        schoolLevel: "HIGH",
        divisionId: "div-2a",
        divisionName: "2A",
        minimumEnrollment: 901,
        maximumEnrollment: null,
      }),
    ];
    const result = classify("HIGH", enrollment(700), gapped);
    expect(result.status).toBe("NO_RULE_MATCH");
    expect(result.explanation).toMatch(/gap/);
  });

  it("refuses to choose between overlapping rules", () => {
    const overlapping = [
      rule({
        id: "r-a",
        schoolLevel: "HIGH",
        divisionId: "div-1a",
        divisionName: "1A",
        minimumEnrollment: 0,
        maximumEnrollment: 950,
      }),
      rule({
        id: "r-b",
        schoolLevel: "HIGH",
        divisionId: "div-2a",
        divisionName: "2A",
        minimumEnrollment: 901,
        maximumEnrollment: null,
      }),
    ];
    const result = classify("HIGH", enrollment(920), overlapping);
    expect(result.status).toBe("AMBIGUOUS_RULES");
    expect(result.divisionId).toBeNull();
    expect(result.explanation).toMatch(/1A.*2A|2A.*1A/);
  });

  it("reports no rule for a school level the league has not configured", () => {
    const result = classify("ELEMENTARY", enrollment(300));
    expect(result.status).toBe("NO_RULE_MATCH");
  });
});

describe("effective dating", () => {
  it("ignores rules that have not taken effect yet", () => {
    const future = IEN_RULES.map((r) =>
      r.schoolLevel === "HIGH" ? { ...r, effectiveFrom: new Date("2027-01-01T00:00:00Z") } : r,
    );
    expect(classify("HIGH", enrollment(500), future).status).toBe("NO_RULE_MATCH");
  });

  it("ignores rules that have expired", () => {
    const expired = IEN_RULES.map((r) =>
      r.schoolLevel === "HIGH" ? { ...r, effectiveUntil: new Date("2026-06-01T00:00:00Z") } : r,
    );
    expect(classify("HIGH", enrollment(500), expired).status).toBe("NO_RULE_MATCH");
  });

  it("applies a superseding rule set once it takes effect", () => {
    // A league that raises the 1A ceiling for a future season keeps the old
    // rule on record; only the effective window changes which one applies.
    const rules: DivisionRule[] = [
      rule({
        id: "r-old",
        schoolLevel: "HIGH",
        divisionId: "div-1a",
        divisionName: "1A",
        minimumEnrollment: 0,
        maximumEnrollment: 900,
        effectiveUntil: new Date("2026-07-01T00:00:00Z"),
      }),
      rule({
        id: "r-new",
        schoolLevel: "HIGH",
        divisionId: "div-1a",
        divisionName: "1A",
        minimumEnrollment: 0,
        maximumEnrollment: 1000,
        effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      }),
    ];
    const result = classify("HIGH", enrollment(950), rules);
    expect(result.status).toBe("CLASSIFIED");
    expect(result.matchedRuleId).toBe("r-new");
  });
});

describe("explanations", () => {
  it("names the enrollment figure, its source, and the rule that decided it", () => {
    const result = classify("HIGH", enrollment(876));
    expect(result.explanation).toContain("876");
    expect(result.explanation).toContain("CCD 2024-25 v.1a");
    expect(result.explanation).toContain("0-900");
    expect(result.explanation).toContain("1A");
  });

  it("always returns a non-empty explanation, whatever the outcome", () => {
    const cases = [
      classify("HIGH", enrollment(500)),
      classify("HIGH", null),
      classify(null, enrollment(500)),
      classify("MIDDLE", null),
      classify("ELEMENTARY", enrollment(300)),
      classify("HIGH", enrollment(950, { scope: "TOTAL" })),
    ];
    for (const result of cases) {
      expect(result.explanation.trim().length).toBeGreaterThan(20);
    }
  });

  it("records the enrollment row it used, so the decision is traceable", () => {
    const result = classify("HIGH", enrollment(876, { id: "enr-abc" }));
    expect(result.enrollmentRecordId).toBe("enr-abc");
  });
});
