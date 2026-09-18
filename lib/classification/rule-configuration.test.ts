import { describe, expect, it } from "vitest";

import {
  validateDivisionRuleConfiguration,
  type ProposedDivisionRule,
} from "./rule-configuration";

function rule(overrides: Partial<ProposedDivisionRule> = {}): ProposedDivisionRule {
  return {
    divisionId: "division-a",
    schoolLevel: "HIGH",
    minimumEnrollment: null,
    maximumEnrollment: null,
    ...overrides,
  };
}

describe("division rule configuration", () => {
  it("accepts adjacent inclusive enrollment ranges", () => {
    const issues = validateDivisionRuleConfiguration([
      rule({ minimumEnrollment: 0, maximumEnrollment: 900 }),
      rule({ divisionId: "division-b", minimumEnrollment: 901, maximumEnrollment: null }),
      rule({ divisionId: null, schoolLevel: "MIDDLE" }),
    ]);

    expect(issues).toEqual([]);
  });

  it("rejects overlapping ranges for the same school level", () => {
    const issues = validateDivisionRuleConfiguration([
      rule({ minimumEnrollment: 0, maximumEnrollment: 900 }),
      rule({ divisionId: "division-b", minimumEnrollment: 900, maximumEnrollment: null }),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0].ruleIndexes).toEqual([0, 1]);
    expect(issues[0].message).toContain("overlap");
  });

  it("reports invalid and negative bounds", () => {
    const issues = validateDivisionRuleConfiguration([
      rule({ minimumEnrollment: -1, maximumEnrollment: 20 }),
      rule({ schoolLevel: "MIDDLE", minimumEnrollment: 50, maximumEnrollment: 10 }),
    ]);

    expect(issues.map((issue) => issue.message)).toEqual([
      "Rule 1 has a negative minimum enrollment.",
      "Rule 2 has a minimum enrollment greater than its maximum.",
    ]);
  });
});
