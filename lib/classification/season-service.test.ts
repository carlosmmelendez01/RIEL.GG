import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  classifySeasonSchool,
  overrideSeasonSchoolClassification,
} from "./season-service";

describe("season classification persistence", () => {
  it("persists the 900/901/high-school boundary and middle-school no-division result", async () => {
    const db = new FakeClassificationDb();

    const high900 = await classifySeasonSchool({
      seasonId: "season-1",
      schoolId: "school-900",
      db: db as unknown as PrismaClient,
    });
    const high901 = await classifySeasonSchool({
      seasonId: "season-1",
      schoolId: "school-901",
      db: db as unknown as PrismaClient,
    });
    const middle = await classifySeasonSchool({
      seasonId: "season-1",
      schoolId: "school-middle",
      db: db as unknown as PrismaClient,
    });

    expect(high900.status).toBe("CLASSIFIED");
    expect(high900.effectiveDivision?.name).toBe("1A");
    expect(high901.status).toBe("CLASSIFIED");
    expect(high901.effectiveDivision?.name).toBe("2A");
    expect(middle.status).toBe("NO_DIVISION");
    expect(middle.effectiveDivisionId).toBeNull();
  });

  it("allows an admin override only with a reason and writes an audit row", async () => {
    const db = new FakeClassificationDb();

    await expect(
      overrideSeasonSchoolClassification({
        seasonId: "season-1",
        schoolId: "school-900",
        divisionId: "div-2a",
        reason: "no",
        actorUserId: "user-admin",
        db: db as unknown as PrismaClient,
      }),
    ).rejects.toThrow("requires a reason");

    const row = await overrideSeasonSchoolClassification({
      seasonId: "season-1",
      schoolId: "school-900",
      divisionId: "div-2a",
      reason: "Approved appeal from league director.",
      actorUserId: "user-admin",
      db: db as unknown as PrismaClient,
    });

    expect(row.method).toBe("ADMIN_OVERRIDE");
    expect(row.effectiveDivision?.name).toBe("2A");
    expect(row.overrideReason).toBe("Approved appeal from league director.");
    expect(row.lockedAt).toBeInstanceOf(Date);
    expect(db.auditLogs).toHaveLength(1);
    expect(db.auditLogs[0].action).toBe("SCHOOL.CLASSIFICATION_OVERRIDE");
    expect(db.auditLogs[0].metadata).toEqual({ reason: "Approved appeal from league director." });
  });

  it("recalculates locked rows after enrollment changes without moving the effective division", async () => {
    const db = new FakeClassificationDb();

    await overrideSeasonSchoolClassification({
      seasonId: "season-1",
      schoolId: "school-900",
      divisionId: "div-1a",
      reason: "Existing competition placement is locked.",
      actorUserId: "user-admin",
      db: db as unknown as PrismaClient,
    });
    db.setEnrollment("school-900", 901);

    const row = await classifySeasonSchool({
      seasonId: "season-1",
      schoolId: "school-900",
      db: db as unknown as PrismaClient,
    });

    expect(row.method).toBe("ADMIN_OVERRIDE");
    expect(row.effectiveDivision?.name).toBe("1A");
    expect(row.calculatedDivision?.name).toBe("2A");
    expect(row.reviewNeeded).toBe(true);
    expect(row.explanation).toContain("901");
  });
});

type ClassificationRow = {
  id: string;
  seasonId: string;
  schoolId: string;
  status: string;
  method: string;
  calculatedDivisionId: string | null;
  effectiveDivisionId: string | null;
  ruleId: string | null;
  enrollmentId: string | null;
  explanation: string;
  overrideReason: string | null;
  reviewNeeded: boolean;
  reviewReason: string | null;
  lockedAt: Date | null;
  lockedById: string | null;
  classifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

class FakeClassificationDb {
  readonly auditLogs: Array<Record<string, unknown>> = [];

  private readonly seasons = [
    {
      id: "season-1",
      leagueId: "league-1",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  ];

  private readonly schools = [
    { id: "school-900", name: "Boundary High 900", level: "HIGH" },
    { id: "school-901", name: "Boundary High 901", level: "HIGH" },
    { id: "school-middle", name: "Boundary Middle", level: "MIDDLE" },
  ];

  private readonly enrollments = new Map<string, { id: string; enrollment: number }>([
    ["school-900", { id: "enroll-900", enrollment: 900 }],
    ["school-901", { id: "enroll-901", enrollment: 901 }],
  ]);

  private readonly divisions = [
    { id: "div-1a", leagueId: "league-1", name: "1A", active: true },
    { id: "div-2a", leagueId: "league-1", name: "2A", active: true },
  ];

  private readonly rules = [
    {
      id: "rule-1a",
      leagueId: "league-1",
      divisionId: "div-1a",
      schoolLevel: "HIGH",
      enrollmentScope: "GRADES_9_12",
      minimumEnrollment: 0,
      maximumEnrollment: 900,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveUntil: null,
    },
    {
      id: "rule-2a",
      leagueId: "league-1",
      divisionId: "div-2a",
      schoolLevel: "HIGH",
      enrollmentScope: "GRADES_9_12",
      minimumEnrollment: 901,
      maximumEnrollment: null,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveUntil: null,
    },
    {
      id: "rule-ms",
      leagueId: "league-1",
      divisionId: null,
      schoolLevel: "MIDDLE",
      enrollmentScope: "GRADES_9_12",
      minimumEnrollment: null,
      maximumEnrollment: null,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveUntil: null,
    },
  ];

  private readonly memberships = [
    { leagueId: "league-1", schoolId: "school-900", status: "ACTIVE" },
    { leagueId: "league-1", schoolId: "school-901", status: "ACTIVE" },
    { leagueId: "league-1", schoolId: "school-middle", status: "ACTIVE" },
  ];

  private readonly classifications: ClassificationRow[] = [];

  readonly season = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.seasons.find((season) => season.id === where.id) ?? null,
  };

  readonly school = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const school = this.schools.find((row) => row.id === where.id);
      if (!school) return null;
      const enrollment = this.enrollments.get(school.id);
      return {
        ...school,
        enrollments: enrollment
          ? [
              {
                ...enrollment,
                schoolYear: "2024-25",
                scope: "GRADES_9_12",
                source: "NCES_CCD",
                datasetRelease: "CCD 2024-25 membership v.1a",
              },
            ]
          : [],
      };
    },
  };

  readonly divisionRule = {
    findMany: async ({ where }: { where: { leagueId: string; enrollmentScope: string } }) =>
      this.rules
        .filter(
          (rule) =>
            rule.leagueId === where.leagueId && rule.enrollmentScope === where.enrollmentScope,
        )
        .map((rule) => ({
          ...rule,
          division: this.divisions.find((division) => division.id === rule.divisionId) ?? null,
        })),
  };

  readonly leagueMembership = {
    findUnique: async ({
      where,
    }: {
      where: { leagueId_schoolId: { leagueId: string; schoolId: string } };
    }) =>
      this.memberships.find(
        (membership) =>
          membership.leagueId === where.leagueId_schoolId.leagueId &&
          membership.schoolId === where.leagueId_schoolId.schoolId,
      ) ?? null,
  };

  readonly division = {
    findFirst: async ({ where }: { where: { id: string; leagueId: string; active: true } }) =>
      this.divisions.find(
        (division) =>
          division.id === where.id &&
          division.leagueId === where.leagueId &&
          division.active === where.active,
      ) ?? null,
  };

  readonly seasonSchoolClassification = {
    findUnique: async ({
      where,
    }: {
      where: { seasonId_schoolId: { seasonId: string; schoolId: string } };
    }) =>
      this.decorate(
        this.classifications.find(
          (row) =>
            row.seasonId === where.seasonId_schoolId.seasonId &&
            row.schoolId === where.seasonId_schoolId.schoolId,
        ) ?? null,
      ),
    update: async ({ where, data }: { where: { id: string }; data: Partial<ClassificationRow> }) => {
      const index = this.classifications.findIndex((row) => row.id === where.id);
      if (index === -1) throw new Error(`Missing classification ${where.id}`);
      this.classifications[index] = {
        ...this.classifications[index],
        ...data,
        updatedAt: new Date(),
      };
      return this.decorate(this.classifications[index]);
    },
    create: async ({ data }: { data: Omit<ClassificationRow, "id" | "createdAt" | "updatedAt"> }) => {
      const now = new Date();
      const row: ClassificationRow = {
        id: `classification-${this.classifications.length + 1}`,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      this.classifications.push(row);
      return this.decorate(row);
    },
  };

  readonly auditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.auditLogs.push(data);
      return data;
    },
  };

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  setEnrollment(schoolId: string, enrollment: number) {
    const existing = this.enrollments.get(schoolId);
    this.enrollments.set(schoolId, {
      id: existing?.id ?? `enroll-${schoolId}`,
      enrollment,
    });
  }

  private decorate(row: ClassificationRow | null) {
    if (!row) return null;
    return {
      ...row,
      effectiveDivision: this.divisions.find((division) => division.id === row.effectiveDivisionId) ?? null,
      calculatedDivision: this.divisions.find((division) => division.id === row.calculatedDivisionId) ?? null,
    };
  }
}
