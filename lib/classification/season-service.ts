import type { Prisma, PrismaClient } from "@prisma/client";

import {
  classifySchool,
  type ClassificationResult,
  type DivisionRule as DomainDivisionRule,
  type EnrollmentRecord,
  type SchoolLevel,
} from "@/lib/domain/classification";
import { prisma } from "@/lib/db/prisma";
import {
  validateDivisionRuleConfiguration,
  type ProposedDivisionRule,
} from "@/lib/classification/rule-configuration";

type DbClient = PrismaClient | Prisma.TransactionClient;

const CLASSIFICATION_SCOPE = "GRADES_9_12" as const;
const LEGACY_OVERRIDE_REASON = "Preserved from existing league membership division.";

const classificationSelect = {
  id: true,
  seasonId: true,
  schoolId: true,
  status: true,
  method: true,
  calculatedDivisionId: true,
  effectiveDivisionId: true,
  ruleId: true,
  enrollmentId: true,
  explanation: true,
  overrideReason: true,
  reviewNeeded: true,
  reviewReason: true,
  lockedAt: true,
  lockedById: true,
  classifiedAt: true,
  createdAt: true,
  updatedAt: true,
  effectiveDivision: { select: { id: true, name: true } },
  calculatedDivision: { select: { id: true, name: true } },
} satisfies Prisma.SeasonSchoolClassificationSelect;

export type PersistedSeasonClassification = Prisma.SeasonSchoolClassificationGetPayload<{
  select: typeof classificationSelect;
}>;

type ClassificationPlan = {
  season: {
    id: string;
    leagueId: string;
    startsAt: Date;
  };
  school: {
    id: string;
    name: string;
  };
  result: ClassificationResult;
};

export type PreserveLegacyResult = {
  examined: number;
  preserved: number;
  skippedLocked: number;
};

export type DivisionOption = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
};

export type DivisionRuleOption = ProposedDivisionRule & {
  id: string;
  divisionName: string | null;
};

export type DivisionRulePreviewRow = {
  schoolId: string;
  schoolName: string;
  schoolLevel: SchoolLevel | null;
  enrollment: number | null;
  status: ClassificationResult["status"];
  divisionName: string | null;
  explanation: string;
};

export type DivisionRulePreview = {
  seasonId: string;
  seasonName: string;
  rows: DivisionRulePreviewRow[];
};

export async function listLeagueDivisions(
  leagueId: string,
  db: DbClient = prisma,
): Promise<DivisionOption[]> {
  return db.division.findMany({
    where: { leagueId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      sortOrder: true,
    },
  });
}

export async function listLeagueDivisionRules(
  leagueId: string,
  asOf: Date,
  db: DbClient = prisma,
): Promise<DivisionRuleOption[]> {
  const rows = await db.divisionRule.findMany({
    where: {
      leagueId,
      enrollmentScope: CLASSIFICATION_SCOPE,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: asOf } }],
    },
    orderBy: [
      { schoolLevel: "asc" },
      { minimumEnrollment: "asc" },
      { maximumEnrollment: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      divisionId: true,
      schoolLevel: true,
      minimumEnrollment: true,
      maximumEnrollment: true,
      division: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    divisionId: row.divisionId,
    divisionName: row.division?.name ?? null,
    schoolLevel: row.schoolLevel,
    minimumEnrollment: row.minimumEnrollment,
    maximumEnrollment: row.maximumEnrollment,
  }));
}

/** Compute proposed classifications for active member schools without writing rows. */
export async function previewLeagueDivisionRules(input: {
  leagueId: string;
  seasonId: string;
  rules: ProposedDivisionRule[];
  db?: DbClient;
}): Promise<DivisionRulePreview> {
  const db = input.db ?? prisma;
  assertValidRuleConfiguration(input.rules);

  const season = await db.season.findFirst({
    where: { id: input.seasonId, leagueId: input.leagueId },
    select: { id: true, name: true, startsAt: true },
  });
  if (!season) throw new Error("Season not found in this league.");

  const divisionNames = await loadRuleDivisionNames(db, input.leagueId, input.rules);
  const memberships = await db.leagueMembership.findMany({
    where: { leagueId: input.leagueId, status: "ACTIVE" },
    orderBy: { school: { name: "asc" } },
    select: {
      school: {
        select: {
          id: true,
          name: true,
          level: true,
          enrollments: {
            where: { scope: CLASSIFICATION_SCOPE },
            orderBy: [{ schoolYear: "desc" }, { importedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              schoolYear: true,
              enrollment: true,
              scope: true,
              source: true,
              datasetRelease: true,
            },
          },
        },
      },
    },
  });

  const rules = input.rules.map((rule, index): DomainDivisionRule => ({
    id: rule.id ?? `preview-rule-${index + 1}`,
    divisionId: rule.divisionId,
    divisionName: rule.divisionId ? divisionNames.get(rule.divisionId) ?? null : null,
    schoolLevel: rule.schoolLevel,
    minimumEnrollment: rule.minimumEnrollment,
    maximumEnrollment: rule.maximumEnrollment,
    effectiveFrom: season.startsAt,
    effectiveUntil: null,
  }));

  const rows = memberships.map(({ school }): DivisionRulePreviewRow => {
    const enrollment = school.enrollments[0] ? toEnrollmentRecord(school.enrollments[0]) : null;
    const result = classifySchool({
      schoolName: school.name,
      schoolLevel: school.level,
      enrollment,
      rules,
      asOf: season.startsAt,
      scope: CLASSIFICATION_SCOPE,
    });

    return {
      schoolId: school.id,
      schoolName: school.name,
      schoolLevel: school.level,
      enrollment: enrollment?.enrollment ?? null,
      status: result.status,
      divisionName: result.divisionName,
      explanation: result.explanation,
    };
  });

  return {
    seasonId: season.id,
    seasonName: season.name,
    rows,
  };
}

/** Save the current season's rule set. Historical, referenced rules cannot be removed. */
export async function replaceLeagueDivisionRules(input: {
  leagueId: string;
  seasonId: string;
  actorUserId: string;
  rules: ProposedDivisionRule[];
  db?: PrismaClient;
}): Promise<DivisionRuleOption[]> {
  assertValidRuleConfiguration(input.rules);
  const client = input.db ?? prisma;

  return client.$transaction(async (tx) => {
    const season = await tx.season.findFirst({
      where: { id: input.seasonId, leagueId: input.leagueId },
      select: { id: true, startsAt: true },
    });
    if (!season) throw new Error("Season not found in this league.");

    await loadRuleDivisionNames(tx, input.leagueId, input.rules);
    const before = await listLeagueDivisionRules(input.leagueId, season.startsAt, tx);
    const beforeById = new Map(before.map((rule) => [rule.id, rule]));
    const retainedIds = input.rules.flatMap((rule) => (rule.id ? [rule.id] : []));

    if (new Set(retainedIds).size !== retainedIds.length) {
      throw new Error("The same division rule was submitted more than once.");
    }
    for (const id of retainedIds) {
      if (!beforeById.has(id)) {
        throw new Error("The division rules are out of date. Refresh and try again.");
      }
    }

    const removedIds = before
      .filter((rule) => !retainedIds.includes(rule.id))
      .map((rule) => rule.id);
    if (removedIds.length > 0) {
      const referenced = await tx.divisionRule.findMany({
        where: { id: { in: removedIds } },
        select: {
          id: true,
          _count: { select: { classifications: true } },
        },
      });
      if (referenced.some((rule) => rule._count.classifications > 0)) {
        throw new Error(
          "A rule already used by a classification cannot be removed. Keep it for audit history.",
        );
      }
      await tx.divisionRule.deleteMany({ where: { id: { in: removedIds } } });
    }

    for (const rule of input.rules) {
      const data = {
        divisionId: rule.divisionId,
        schoolLevel: rule.schoolLevel,
        enrollmentScope: CLASSIFICATION_SCOPE,
        minimumEnrollment: rule.minimumEnrollment,
        maximumEnrollment: rule.maximumEnrollment,
        effectiveFrom: season.startsAt,
        effectiveUntil: null,
      };

      if (rule.id) {
        await tx.divisionRule.update({ where: { id: rule.id }, data });
      } else {
        await tx.divisionRule.create({
          data: {
            leagueId: input.leagueId,
            ...data,
          },
        });
      }
    }

    const after = await listLeagueDivisionRules(input.leagueId, season.startsAt, tx);
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "LEAGUE.DIVISION_RULES_UPDATE",
        entityType: "League",
        entityId: input.leagueId,
        before,
        after,
        metadata: { seasonId: season.id },
        leagueId: input.leagueId,
      },
    });

    return after;
  });
}

export async function classifySeasonSchool(input: {
  seasonId: string;
  schoolId: string;
  db?: DbClient;
}): Promise<PersistedSeasonClassification> {
  const db = input.db ?? prisma;
  const plan = await calculateSeasonSchool(db, input.seasonId, input.schoolId);
  const existing = await db.seasonSchoolClassification.findUnique({
    where: { seasonId_schoolId: { seasonId: input.seasonId, schoolId: input.schoolId } },
    select: classificationSelect,
  });

  return persistCalculatedClassification(db, plan, existing, new Date());
}

export async function classifySeasonMemberSchools(input: {
  seasonId: string;
  db?: DbClient;
}): Promise<{ examined: number; classified: number }> {
  const db = input.db ?? prisma;
  const season = await db.season.findUnique({
    where: { id: input.seasonId },
    select: { leagueId: true },
  });
  if (!season) throw new Error("Season not found.");

  const memberships = await db.leagueMembership.findMany({
    where: { leagueId: season.leagueId, status: "ACTIVE" },
    select: { schoolId: true },
    orderBy: { joinedAt: "asc" },
  });

  let classified = 0;
  for (const membership of memberships) {
    await classifySeasonSchool({ seasonId: input.seasonId, schoolId: membership.schoolId, db });
    classified += 1;
  }

  return { examined: memberships.length, classified };
}

export async function preserveLegacySeasonClassifications(input: {
  seasonId: string;
  actorUserId?: string | null;
  db?: PrismaClient;
}): Promise<PreserveLegacyResult> {
  const client = input.db ?? prisma;
  return client.$transaction(async (tx) => {
    const season = await tx.season.findUnique({
      where: { id: input.seasonId },
      select: { id: true, leagueId: true },
    });
    if (!season) throw new Error("Season not found.");

    const memberships = await tx.leagueMembership.findMany({
      where: {
        leagueId: season.leagueId,
        status: "ACTIVE",
        division: { not: null },
      },
      select: {
        schoolId: true,
        division: true,
      },
      orderBy: { joinedAt: "asc" },
    });

    const now = new Date();
    let preserved = 0;
    let skippedLocked = 0;

    for (const membership of memberships) {
      const legacyDivisionName = membership.division?.trim();
      if (!legacyDivisionName) continue;

      const existing = await tx.seasonSchoolClassification.findUnique({
        where: {
          seasonId_schoolId: {
            seasonId: season.id,
            schoolId: membership.schoolId,
          },
        },
        select: classificationSelect,
      });
      if (existing?.lockedAt) {
        skippedLocked += 1;
        continue;
      }

      const division = await tx.division.upsert({
        where: {
          leagueId_name: {
            leagueId: season.leagueId,
            name: legacyDivisionName,
          },
        },
        update: { active: true },
        create: {
          leagueId: season.leagueId,
          name: legacyDivisionName,
          slug: slugifyDivisionName(legacyDivisionName),
          sortOrder: preserved,
        },
        select: { id: true },
      });

      const plan = await calculateSeasonSchool(tx, season.id, membership.schoolId);
      await persistOverride(tx, {
        plan,
        existing,
        divisionId: division.id,
        reason: LEGACY_OVERRIDE_REASON,
        actorUserId: input.actorUserId ?? null,
        now,
        audit: false,
      });
      preserved += 1;
    }

    return { examined: memberships.length, preserved, skippedLocked };
  });
}

export async function overrideSeasonSchoolClassification(input: {
  seasonId: string;
  schoolId: string;
  divisionId: string | null;
  reason: string;
  actorUserId: string;
  db?: PrismaClient;
}): Promise<PersistedSeasonClassification> {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new Error("A classification override requires a reason.");
  }

  const client = input.db ?? prisma;
  return client.$transaction(async (tx) => {
    const plan = await calculateSeasonSchool(tx, input.seasonId, input.schoolId);

    const membership = await tx.leagueMembership.findUnique({
      where: {
        leagueId_schoolId: {
          leagueId: plan.season.leagueId,
          schoolId: input.schoolId,
        },
      },
      select: { id: true },
    });
    if (!membership) throw new Error("School is not a member of this league.");

    if (input.divisionId !== null) {
      const division = await tx.division.findFirst({
        where: { id: input.divisionId, leagueId: plan.season.leagueId, active: true },
        select: { id: true },
      });
      if (!division) throw new Error("Division not found in this league.");
    }

    const existing = await tx.seasonSchoolClassification.findUnique({
      where: {
        seasonId_schoolId: {
          seasonId: input.seasonId,
          schoolId: input.schoolId,
        },
      },
      select: classificationSelect,
    });

    return persistOverride(tx, {
      plan,
      existing,
      divisionId: input.divisionId,
      reason,
      actorUserId: input.actorUserId,
      now: new Date(),
      audit: true,
    });
  });
}

export async function upsertLeagueDivisions(input: {
  leagueId: string;
  divisions: Array<{
    id?: string;
    name: string;
    description?: string | null;
    active?: boolean;
  }>;
  actorUserId?: string | null;
  db?: PrismaClient;
}): Promise<DivisionOption[]> {
  const client = input.db ?? prisma;
  return client.$transaction(async (tx) => {
    const before = await listLeagueDivisions(input.leagueId, tx);
    const seenNames = new Set<string>();
    for (const division of input.divisions) {
      const normalized = division.name.trim().toLowerCase();
      if (!normalized) throw new Error("Division name is required.");
      if (seenNames.has(normalized)) throw new Error("Division names must be unique.");
      seenNames.add(normalized);
    }

    const retainedIds: string[] = [];
    for (const [index, division] of input.divisions.entries()) {
      const data = {
        name: division.name.trim(),
        slug: slugifyDivisionName(division.name),
        description: division.description?.trim() || null,
        active: division.active ?? true,
        sortOrder: index,
      };

      if (division.id) {
        const existing = await tx.division.findFirst({
          where: { id: division.id, leagueId: input.leagueId },
          select: { id: true },
        });
        if (!existing) throw new Error("The division list is out of date. Refresh and try again.");
        const updated = await tx.division.update({
          where: { id: division.id },
          data,
          select: { id: true },
        });
        retainedIds.push(updated.id);
      } else {
        const upserted = await tx.division.upsert({
          where: {
            leagueId_name: {
              leagueId: input.leagueId,
              name: data.name,
            },
          },
          update: data,
          create: {
            leagueId: input.leagueId,
            ...data,
          },
          select: { id: true },
        });
        retainedIds.push(upserted.id);
      }
    }

    await tx.division.updateMany({
      where: {
        leagueId: input.leagueId,
        id: { notIn: retainedIds.length > 0 ? retainedIds : [""] },
      },
      data: { active: false },
    });

    const after = await listLeagueDivisions(input.leagueId, tx);
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: "LEAGUE.DIVISIONS_UPDATE",
        entityType: "League",
        entityId: input.leagueId,
        before,
        after,
        leagueId: input.leagueId,
      },
    });

    return after;
  });
}

function assertValidRuleConfiguration(rules: ProposedDivisionRule[]) {
  const issues = validateDivisionRuleConfiguration(rules);
  if (issues.length > 0) {
    throw new Error(issues[0].message);
  }
}

async function loadRuleDivisionNames(
  db: DbClient,
  leagueId: string,
  rules: ProposedDivisionRule[],
): Promise<Map<string, string>> {
  const divisionIds = Array.from(
    new Set(rules.flatMap((rule) => (rule.divisionId ? [rule.divisionId] : []))),
  );
  if (divisionIds.length === 0) return new Map();

  const divisions = await db.division.findMany({
    where: {
      id: { in: divisionIds },
      leagueId,
      active: true,
    },
    select: { id: true, name: true },
  });
  if (divisions.length !== divisionIds.length) {
    throw new Error("Every rule must use an active division from this league.");
  }

  return new Map(divisions.map((division) => [division.id, division.name]));
}

async function calculateSeasonSchool(
  db: DbClient,
  seasonId: string,
  schoolId: string,
): Promise<ClassificationPlan> {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: { id: true, leagueId: true, startsAt: true },
  });
  if (!season) throw new Error("Season not found.");

  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      level: true,
      enrollments: {
        where: { scope: CLASSIFICATION_SCOPE },
        orderBy: [{ schoolYear: "desc" }, { importedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          schoolYear: true,
          enrollment: true,
          scope: true,
          source: true,
          datasetRelease: true,
        },
      },
    },
  });
  if (!school) throw new Error("School not found.");

  const rules = await db.divisionRule.findMany({
    where: { leagueId: season.leagueId, enrollmentScope: CLASSIFICATION_SCOPE },
    include: { division: { select: { name: true } } },
    orderBy: [
      { schoolLevel: "asc" },
      { minimumEnrollment: "asc" },
      { maximumEnrollment: "asc" },
      { effectiveFrom: "asc" },
    ],
  });

  const enrollment = school.enrollments[0] ? toEnrollmentRecord(school.enrollments[0]) : null;
  const result = classifySchool({
    schoolName: school.name,
    schoolLevel: school.level,
    enrollment,
    rules: rules.map(toDomainRule),
    asOf: season.startsAt,
    scope: CLASSIFICATION_SCOPE,
  });

  return {
    season,
    school: {
      id: school.id,
      name: school.name,
    },
    result,
  };
}

async function persistCalculatedClassification(
  db: DbClient,
  plan: ClassificationPlan,
  existing: PersistedSeasonClassification | null,
  now: Date,
): Promise<PersistedSeasonClassification> {
  const calculation = calculatedFields(plan.result);

  if (existing?.lockedAt) {
    const reviewNeeded = !resultMatchesEffective(plan.result, existing.effectiveDivisionId);
    return db.seasonSchoolClassification.update({
      where: { id: existing.id },
      data: {
        ...calculation,
        reviewNeeded,
        reviewReason: reviewNeeded
          ? lockedReviewReason(existing.effectiveDivision?.name ?? null, plan.result)
          : null,
        classifiedAt: now,
      },
      select: classificationSelect,
    });
  }

  const method = methodForResult(plan.result);
  const effectiveDivisionId = plan.result.status === "CLASSIFIED" ? plan.result.divisionId : null;
  const data = {
    ...calculation,
    method,
    effectiveDivisionId,
    overrideReason: null,
    reviewNeeded: false,
    reviewReason: null,
    lockedAt: null,
    lockedById: null,
    classifiedAt: now,
  };

  if (existing) {
    return db.seasonSchoolClassification.update({
      where: { id: existing.id },
      data,
      select: classificationSelect,
    });
  }

  return db.seasonSchoolClassification.create({
    data: {
      seasonId: plan.season.id,
      schoolId: plan.school.id,
      ...data,
    },
    select: classificationSelect,
  });
}

async function persistOverride(
  tx: Prisma.TransactionClient,
  input: {
    plan: ClassificationPlan;
    existing: PersistedSeasonClassification | null;
    divisionId: string | null;
    reason: string;
    actorUserId: string | null;
    now: Date;
    audit: boolean;
  },
): Promise<PersistedSeasonClassification> {
  const calculation = calculatedFields(input.plan.result);
  const reviewNeeded = !resultMatchesEffective(input.plan.result, input.divisionId);
  const data = {
    ...calculation,
    method: "ADMIN_OVERRIDE" as const,
    effectiveDivisionId: input.divisionId,
    overrideReason: input.reason,
    reviewNeeded,
    reviewReason: reviewNeeded
      ? overrideReviewReason(input.divisionId, input.plan.result)
      : null,
    lockedAt: input.now,
    lockedById: input.actorUserId,
    classifiedAt: input.now,
  };

  const row = input.existing
    ? await tx.seasonSchoolClassification.update({
        where: { id: input.existing.id },
        data,
        select: classificationSelect,
      })
    : await tx.seasonSchoolClassification.create({
        data: {
          seasonId: input.plan.season.id,
          schoolId: input.plan.school.id,
          ...data,
        },
        select: classificationSelect,
      });

  if (input.audit) {
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "SCHOOL.CLASSIFICATION_OVERRIDE",
        entityType: "SeasonSchoolClassification",
        entityId: row.id,
        ...(input.existing ? { before: auditClassification(input.existing) } : {}),
        after: auditClassification(row),
        metadata: { reason: input.reason },
        leagueId: input.plan.season.leagueId,
        schoolId: input.plan.school.id,
      },
    });
  }

  return row;
}

function calculatedFields(result: ClassificationResult) {
  return {
    status: result.status,
    calculatedDivisionId: result.status === "CLASSIFIED" ? result.divisionId : null,
    ruleId: result.matchedRuleId,
    enrollmentId: result.enrollmentRecordId,
    explanation: result.explanation,
  };
}

function methodForResult(result: ClassificationResult) {
  if (result.status === "CLASSIFIED") return "RULE" as const;
  if (result.status === "NO_DIVISION") return "NO_DIVISION" as const;
  return "UNCLASSIFIED" as const;
}

function resultMatchesEffective(
  result: ClassificationResult,
  effectiveDivisionId: string | null,
): boolean {
  if (result.status === "CLASSIFIED") return result.divisionId === effectiveDivisionId;
  if (result.status === "NO_DIVISION") return effectiveDivisionId === null;
  return false;
}

function lockedReviewReason(
  effectiveDivisionName: string | null,
  result: ClassificationResult,
): string {
  const current = effectiveDivisionName ?? "no division";
  return `Locked placement remains ${current}, but recalculation returned: ${result.explanation}`;
}

function overrideReviewReason(divisionId: string | null, result: ClassificationResult): string {
  const current = divisionId ? "the manual override" : "no division";
  return `Effective placement remains ${current}, but recalculation returned: ${result.explanation}`;
}

function toDomainRule(
  rule: Prisma.DivisionRuleGetPayload<{ include: { division: { select: { name: true } } } }>,
): DomainDivisionRule {
  return {
    id: rule.id,
    divisionId: rule.divisionId,
    divisionName: rule.division?.name ?? null,
    schoolLevel: rule.schoolLevel,
    minimumEnrollment: rule.minimumEnrollment,
    maximumEnrollment: rule.maximumEnrollment,
    effectiveFrom: rule.effectiveFrom,
    effectiveUntil: rule.effectiveUntil,
  };
}

function toEnrollmentRecord(enrollment: {
  id: string;
  schoolYear: string;
  enrollment: number;
  scope: "GRADES_9_12" | "TOTAL";
  source: string;
  datasetRelease: string | null;
}): EnrollmentRecord {
  return {
    id: enrollment.id,
    schoolYear: enrollment.schoolYear,
    enrollment: enrollment.enrollment,
    scope: enrollment.scope === "TOTAL" ? "TOTAL" : "GRADES_9_12",
    sourceLabel: enrollment.datasetRelease ?? enrollment.source.replaceAll("_", " "),
  };
}

function auditClassification(row: PersistedSeasonClassification) {
  return {
    id: row.id,
    status: row.status,
    method: row.method,
    calculatedDivisionId: row.calculatedDivisionId,
    effectiveDivisionId: row.effectiveDivisionId,
    ruleId: row.ruleId,
    enrollmentId: row.enrollmentId,
    explanation: row.explanation,
    overrideReason: row.overrideReason,
    reviewNeeded: row.reviewNeeded,
    reviewReason: row.reviewReason,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedById: row.lockedById,
  };
}

function slugifyDivisionName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
