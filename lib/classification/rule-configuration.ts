import type { SchoolLevel } from "@/lib/domain/classification";

export type ProposedDivisionRule = {
  id?: string;
  divisionId: string | null;
  schoolLevel: SchoolLevel;
  minimumEnrollment: number | null;
  maximumEnrollment: number | null;
};

export type RuleConfigurationIssue = {
  ruleIndexes: number[];
  message: string;
};

/**
 * Validate a proposed set before previewing or saving it.
 *
 * Enrollment bounds are inclusive, so 0-900 and 900+ overlap while 0-900
 * and 901+ do not. Different school levels are independent rule sets.
 */
export function validateDivisionRuleConfiguration(
  rules: ProposedDivisionRule[],
): RuleConfigurationIssue[] {
  const issues: RuleConfigurationIssue[] = [];

  for (const [index, rule] of rules.entries()) {
    if (rule.minimumEnrollment !== null && rule.minimumEnrollment < 0) {
      issues.push({
        ruleIndexes: [index],
        message: `Rule ${index + 1} has a negative minimum enrollment.`,
      });
    }
    if (rule.maximumEnrollment !== null && rule.maximumEnrollment < 0) {
      issues.push({
        ruleIndexes: [index],
        message: `Rule ${index + 1} has a negative maximum enrollment.`,
      });
    }
    if (
      rule.minimumEnrollment !== null &&
      rule.maximumEnrollment !== null &&
      rule.minimumEnrollment > rule.maximumEnrollment
    ) {
      issues.push({
        ruleIndexes: [index],
        message: `Rule ${index + 1} has a minimum enrollment greater than its maximum.`,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < rules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rules.length; rightIndex += 1) {
      const left = rules[leftIndex];
      const right = rules[rightIndex];
      if (left.schoolLevel !== right.schoolLevel) continue;
      if (!rangesOverlap(left, right)) continue;

      issues.push({
        ruleIndexes: [leftIndex, rightIndex],
        message:
          `Rules ${leftIndex + 1} and ${rightIndex + 1} overlap for ` +
          `${schoolLevelLabel(left.schoolLevel)} schools. Enrollment ranges are inclusive.`,
      });
    }
  }

  return issues;
}

function rangesOverlap(left: ProposedDivisionRule, right: ProposedDivisionRule): boolean {
  const leftMinimum = left.minimumEnrollment ?? Number.NEGATIVE_INFINITY;
  const leftMaximum = left.maximumEnrollment ?? Number.POSITIVE_INFINITY;
  const rightMinimum = right.minimumEnrollment ?? Number.NEGATIVE_INFINITY;
  const rightMaximum = right.maximumEnrollment ?? Number.POSITIVE_INFINITY;

  return leftMinimum <= rightMaximum && rightMinimum <= leftMaximum;
}

function schoolLevelLabel(level: SchoolLevel): string {
  return level.toLowerCase().replaceAll("_", " ");
}
