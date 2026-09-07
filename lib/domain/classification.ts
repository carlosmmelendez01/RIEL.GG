/**
 * Division classification — pure rule evaluation.
 *
 * This module deliberately imports nothing: no Prisma, no env, no React. It
 * takes plain data in and returns a decision out, which is what lets the whole
 * rule set be tested without a database and reused identically by the coach UI,
 * the admin UI, and the NCES importer.
 *
 * The persistence layer (SeasonSchoolClassification) sits on top of this and is
 * added in a later increment. This is the part that decides "1A or 2A"; that
 * part decides when the answer is recorded and locked.
 *
 * Rules come from the league's DivisionRule rows. Nothing here knows what
 * "IEN" is — the 0-900 / 901+ boundary is data, not code.
 */

export type SchoolLevel = "ELEMENTARY" | "MIDDLE" | "HIGH" | "OTHER";

/**
 * Which enrollment figure a rule is measured against.
 *
 * IEN classifies on grades 9-12, matching how the IHSAA classifies Indiana
 * schools. TOTAL is stored for display but is not the classification input
 * unless a league configures it that way.
 */
export type EnrollmentScope = "GRADES_9_12" | "TOTAL";

export type DivisionRule = {
  id: string;
  /** null means "schools matching this rule get NO division" (e.g. middle school). */
  divisionId: string | null;
  divisionName: string | null;
  schoolLevel: SchoolLevel;
  /** Inclusive lower bound. null = unbounded below. */
  minimumEnrollment: number | null;
  /** Inclusive upper bound. null = unbounded above. */
  maximumEnrollment: number | null;
  effectiveFrom: Date;
  /** Exclusive upper bound on the effective window. null = still in effect. */
  effectiveUntil: Date | null;
};

export type EnrollmentRecord = {
  id: string;
  schoolYear: string;
  enrollment: number;
  scope: EnrollmentScope;
  /** e.g. "CCD 2024-25 v.1a" — carried into the explanation so the answer is traceable. */
  sourceLabel: string;
};

export type ClassificationInput = {
  schoolName: string;
  schoolLevel: SchoolLevel | null;
  /** The enrollment row selected for this season, or null if none exists yet. */
  enrollment: EnrollmentRecord | null;
  rules: DivisionRule[];
  /** Which point in time the rules are evaluated at. Defaults to now. */
  asOf?: Date;
  /** Which enrollment scope this league classifies on. Defaults to GRADES_9_12. */
  scope?: EnrollmentScope;
};

export type ClassificationStatus =
  | "CLASSIFIED"
  | "NO_DIVISION"
  | "MISSING_SCHOOL_LEVEL"
  | "MISSING_ENROLLMENT"
  | "ENROLLMENT_SCOPE_MISMATCH"
  | "NO_RULE_MATCH"
  | "AMBIGUOUS_RULES";

export type ClassificationResult = {
  status: ClassificationStatus;
  /** Set only when status is CLASSIFIED. */
  divisionId: string | null;
  divisionName: string | null;
  /** The rule that decided it, for audit. */
  matchedRuleId: string | null;
  /** The enrollment row the decision was based on, for audit. */
  enrollmentRecordId: string | null;
  /**
   * Human-readable, shown directly in the admin UI and in coach-facing
   * explanations. Never a bare code. This is the whole point: "why is this
   * school 2A?" should be answerable on screen, not in a support email.
   */
  explanation: string;
};

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  ELEMENTARY: "Elementary school",
  MIDDLE: "Middle school",
  HIGH: "High school",
  OTHER: "Other school level",
};

const SCOPE_LABEL: Record<EnrollmentScope, string> = {
  GRADES_9_12: "grades 9-12 enrollment",
  TOTAL: "total enrollment",
};

function describeBounds(rule: DivisionRule): string {
  const { minimumEnrollment: min, maximumEnrollment: max } = rule;
  if (min === null && max === null) return "any enrollment";
  if (min === null) return `up to ${max}`;
  if (max === null) return `${min}+`;
  return `${min}-${max}`;
}

function isEffective(rule: DivisionRule, asOf: Date): boolean {
  if (rule.effectiveFrom > asOf) return false;
  if (rule.effectiveUntil !== null && rule.effectiveUntil <= asOf) return false;
  return true;
}

function matchesEnrollment(rule: DivisionRule, enrollment: number): boolean {
  if (rule.minimumEnrollment !== null && enrollment < rule.minimumEnrollment) return false;
  if (rule.maximumEnrollment !== null && enrollment > rule.maximumEnrollment) return false;
  return true;
}

/** A rule with no enrollment bounds applies to the whole school level. */
function isUnbounded(rule: DivisionRule): boolean {
  return rule.minimumEnrollment === null && rule.maximumEnrollment === null;
}

/**
 * Decide which division a school falls into for a season.
 *
 * Returns a status plus a human-readable explanation in every branch —
 * including the failure branches. A caller should never have to invent a
 * message; if classification can't happen, this says exactly what is missing.
 */
export function classifySchool(input: ClassificationInput): ClassificationResult {
  const asOf = input.asOf ?? new Date();
  const scope = input.scope ?? "GRADES_9_12";
  const { schoolName, schoolLevel, enrollment } = input;

  const base = {
    divisionId: null,
    divisionName: null,
    matchedRuleId: null,
    enrollmentRecordId: enrollment?.id ?? null,
  };

  if (schoolLevel === null) {
    return {
      ...base,
      status: "MISSING_SCHOOL_LEVEL",
      explanation:
        `${schoolName} has no school level on record, so no division rule can apply. ` +
        `School level comes from the directory import, or can be set by a league admin.`,
    };
  }

  const applicable = input.rules
    .filter((rule) => isEffective(rule, asOf))
    .filter((rule) => rule.schoolLevel === schoolLevel);

  if (applicable.length === 0) {
    return {
      ...base,
      status: "NO_RULE_MATCH",
      explanation:
        `${LEVEL_LABEL[schoolLevel].toLowerCase()} has no division rule in this league, ` +
        `so ${schoolName} cannot be classified. Add a rule for this school level.`,
    };
  }

  // A single unbounded rule for the level settles it without needing enrollment.
  // This is how "middle school gets no division" works: one rule, null division,
  // no bounds — and crucially, no enrollment lookup required.
  const unbounded = applicable.filter(isUnbounded);
  if (unbounded.length === 1 && applicable.length === 1) {
    const rule = unbounded[0];
    if (rule.divisionId === null) {
      return {
        ...base,
        status: "NO_DIVISION",
        matchedRuleId: rule.id,
        explanation: `${LEVEL_LABEL[schoolLevel]} — this league does not divide ${LEVEL_LABEL[schoolLevel].toLowerCase()} programs into divisions.`,
      };
    }
    return {
      ...base,
      status: "CLASSIFIED",
      divisionId: rule.divisionId,
      divisionName: rule.divisionName,
      matchedRuleId: rule.id,
      explanation: `${LEVEL_LABEL[schoolLevel]} — all ${LEVEL_LABEL[schoolLevel].toLowerCase()} programs are ${rule.divisionName ?? "assigned to one division"}.`,
    };
  }

  // Past this point the rules discriminate by enrollment, so we need a figure.
  if (enrollment === null) {
    return {
      ...base,
      status: "MISSING_ENROLLMENT",
      explanation:
        `${schoolName} has no ${SCOPE_LABEL[scope]} on record, so its division can't be calculated. ` +
        `Import enrollment data or have a league admin enter the figure.`,
    };
  }

  if (enrollment.scope !== scope) {
    return {
      ...base,
      status: "ENROLLMENT_SCOPE_MISMATCH",
      explanation:
        `${schoolName} has ${SCOPE_LABEL[enrollment.scope]} on record, but this league classifies on ` +
        `${SCOPE_LABEL[scope]}. The right figure has not been imported yet.`,
    };
  }

  const matched = applicable.filter((rule) => matchesEnrollment(rule, enrollment.enrollment));

  if (matched.length === 0) {
    const ranges = applicable.map(describeBounds).join(", ");
    return {
      ...base,
      status: "NO_RULE_MATCH",
      explanation:
        `${schoolName} has ${SCOPE_LABEL[scope]} of ${enrollment.enrollment}, which falls outside every ` +
        `${LEVEL_LABEL[schoolLevel].toLowerCase()} rule in this league (${ranges}). The rules have a gap.`,
    };
  }

  if (matched.length > 1) {
    const names = matched
      .map((rule) => `${rule.divisionName ?? "no division"} (${describeBounds(rule)})`)
      .join(" and ");
    return {
      ...base,
      status: "AMBIGUOUS_RULES",
      explanation:
        `${schoolName} matches more than one ${LEVEL_LABEL[schoolLevel].toLowerCase()} rule — ${names}. ` +
        `Overlapping enrollment ranges must be fixed before schools can be classified.`,
    };
  }

  const rule = matched[0];
  const reason =
    `${LEVEL_LABEL[schoolLevel]} - ${SCOPE_LABEL[scope]} ${enrollment.enrollment} ` +
    `(${enrollment.sourceLabel}, ${enrollment.schoolYear}) - league rule ${describeBounds(rule)}`;

  if (rule.divisionId === null) {
    return {
      ...base,
      status: "NO_DIVISION",
      matchedRuleId: rule.id,
      explanation: `${reason} - no division.`,
    };
  }

  return {
    ...base,
    status: "CLASSIFIED",
    divisionId: rule.divisionId,
    divisionName: rule.divisionName,
    matchedRuleId: rule.id,
    enrollmentRecordId: enrollment.id,
    explanation: `${reason} - ${rule.divisionName}.`,
  };
}
