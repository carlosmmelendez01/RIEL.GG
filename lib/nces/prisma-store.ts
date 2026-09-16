import type { PrismaClient } from "@prisma/client";

import type {
  EnrollmentUpsertInput,
  ImportRunCompletion,
  ImportRunInput,
  NcesImportStore,
  SchoolUpsertResult,
} from "./importer";
import {
  classifySeasonSchool,
  preserveLegacySeasonClassifications,
} from "@/lib/classification/season-service";

export class PrismaNcesImportStore implements NcesImportStore {
  constructor(private readonly prisma: PrismaClient) {}

  async hasCompletedImport(release: string): Promise<boolean> {
    const existing = await this.prisma.datasetImport.findFirst({
      where: { source: "CCD", release, status: "COMPLETED" },
      select: { id: true },
    });
    return existing !== null;
  }

  async createImportRun(input: ImportRunInput): Promise<{ id: string }> {
    return this.prisma.datasetImport.create({
      data: {
        source: "CCD",
        release: input.release,
        sourceUrl: input.sourceUrl,
        status: "RUNNING",
      },
      select: { id: true },
    });
  }

  async completeImportRun(id: string, completion: ImportRunCompletion): Promise<void> {
    await this.prisma.datasetImport.update({
      where: { id },
      data: {
        status: "COMPLETED",
        schoolsSeen: completion.schoolsSeen,
        schoolsCreated: completion.schoolsCreated,
        schoolsUpdated: completion.schoolsUpdated,
        enrollmentRows: completion.enrollmentRows,
        errorCount: completion.errorCount,
        errors: completion.errors,
        finishedAt: new Date(),
      },
    });
  }

  async failImportRun(id: string, completion: ImportRunCompletion): Promise<void> {
    await this.prisma.datasetImport.update({
      where: { id },
      data: {
        status: "FAILED",
        schoolsSeen: completion.schoolsSeen,
        schoolsCreated: completion.schoolsCreated,
        schoolsUpdated: completion.schoolsUpdated,
        enrollmentRows: completion.enrollmentRows,
        errorCount: completion.errorCount,
        errors: completion.errors,
        finishedAt: new Date(),
      },
    });
  }

  async upsertSchool(input: Parameters<NcesImportStore["upsertSchool"]>[0]): Promise<SchoolUpsertResult> {
    const data = {
      name: input.record.name,
      city: input.record.city,
      state: input.record.state,
      ncesId: input.record.externalId,
      directorySource: "CCD" as const,
      externalId: input.record.externalId,
      districtName: input.record.districtName,
      districtExternalId: input.record.districtExternalId,
      streetAddress: input.record.streetAddress,
      zip: input.record.zip,
      level: input.record.level,
      lowGrade: input.record.lowGrade,
      highGrade: input.record.highGrade,
      datasetRelease: input.datasetRelease,
      importedAt: input.importedAt,
    };

    const existing = await this.prisma.school.findUnique({
      where: {
        directorySource_externalId: {
          directorySource: "CCD",
          externalId: input.record.externalId,
        },
      },
    });

    if (!existing) {
      const created = await this.prisma.school.create({
        data,
        select: { id: true },
      });
      return { id: created.id, created: true, updated: false };
    }

    if (!changed(existing, data)) {
      return { id: existing.id, created: false, updated: false };
    }

    const updated = await this.prisma.school.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
    return { id: updated.id, created: false, updated: true };
  }

  async findCcdSchoolByExternalId(externalId: string): Promise<{ id: string } | null> {
    return this.prisma.school.findUnique({
      where: {
        directorySource_externalId: {
          directorySource: "CCD",
          externalId,
        },
      },
      select: { id: true },
    });
  }

  async upsertEnrollment(input: EnrollmentUpsertInput): Promise<{ created: boolean; updated: boolean }> {
    const data = {
      schoolId: input.schoolId,
      schoolYear: input.schoolYear,
      enrollment: input.enrollment,
      scope: input.scope,
      source: "NCES_CCD" as const,
      datasetRelease: input.datasetRelease,
      importedAt: input.importedAt,
      verifiedAt: input.importedAt,
      notes: input.notes,
    };

    const existing = await this.prisma.schoolEnrollment.findUnique({
      where: {
        schoolId_schoolYear_source_scope: {
          schoolId: input.schoolId,
          schoolYear: input.schoolYear,
          source: "NCES_CCD",
          scope: input.scope,
        },
      },
    });

    if (!existing) {
      await this.prisma.schoolEnrollment.create({ data });
      return { created: true, updated: false };
    }

    if (!changed(existing, data)) {
      return { created: false, updated: false };
    }

    await this.prisma.schoolEnrollment.update({
      where: { id: existing.id },
      data,
    });
    return { created: false, updated: true };
  }

  async recalculateClassificationsForSchools(schoolIds: string[]): Promise<void> {
    const uniqueSchoolIds = [...new Set(schoolIds)];
    if (uniqueSchoolIds.length === 0) return;

    const memberships = await this.prisma.leagueMembership.findMany({
      where: {
        schoolId: { in: uniqueSchoolIds },
        status: "ACTIVE",
      },
      select: {
        schoolId: true,
        leagueId: true,
      },
    });
    if (memberships.length === 0) return;

    const leagueIds = [...new Set(memberships.map((membership) => membership.leagueId))];
    const seasons = await this.prisma.season.findMany({
      where: { leagueId: { in: leagueIds } },
      select: {
        id: true,
        leagueId: true,
      },
      orderBy: { startsAt: "desc" },
    });
    if (seasons.length === 0) return;

    const seasonsByLeague = new Map<string, string[]>();
    for (const season of seasons) {
      const ids = seasonsByLeague.get(season.leagueId) ?? [];
      ids.push(season.id);
      seasonsByLeague.set(season.leagueId, ids);
    }

    for (const season of seasons) {
      await preserveLegacySeasonClassifications({ seasonId: season.id, db: this.prisma });
    }

    for (const membership of memberships) {
      const seasonIds = seasonsByLeague.get(membership.leagueId) ?? [];
      for (const seasonId of seasonIds) {
        await classifySeasonSchool({
          seasonId,
          schoolId: membership.schoolId,
          db: this.prisma,
        });
      }
    }
  }
}

function changed<T extends Record<string, unknown>>(existing: Record<string, unknown>, next: T): boolean {
  return Object.entries(next).some(([key, value]) => !same(existing[key], value));
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}
