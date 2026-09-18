import { Prisma, PrismaClient } from "@prisma/client";

import { classifySeasonMemberSchools } from "../lib/classification/season-service";
import {
  INDIANA_CCD_SCHOOL_FIXTURES,
  MANUAL_SCHOOL_CLASSIFICATION_FIXTURES,
  SYNTHETIC_ENROLLMENT_NOTE,
  type IndianaCcdSeedSchoolId,
  type ManualClassificationSeedSchoolId,
} from "../lib/mock/school-directory-fixtures";
import { platformSchoolById } from "../lib/mock/platform-data";

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));

type PublicRepair = {
  seedSchoolId: IndianaCcdSeedSchoolId;
  legacyNcesId?: string;
  legacyCode?: string;
};

const PUBLIC_REPAIRS: PublicRepair[] = [
  { seedSchoolId: "ps-carmel", legacyNcesId: "180519000156" },
  { seedSchoolId: "ps-fishers", legacyNcesId: "180519000182" },
  { seedSchoolId: "ps-hse", legacyNcesId: "180519000183" },
  { seedSchoolId: "ps-nch", legacyNcesId: "180519000201" },
  { seedSchoolId: "ps-cgv", legacyNcesId: "180519000089" },
  { seedSchoolId: "ps-westfield", legacyNcesId: "180519000299" },
  { seedSchoolId: "ps-zionsville", legacyNcesId: "180519000310" },
  { seedSchoolId: "ps-crownpoint", legacyCode: "CPT" },
];

const COLLIDED_LEGACY_NCES_ID = "180519000234";
const COLLISION_TARGET_BY_LEAGUE_SLUG = {
  riel: "ps-mchs",
  hea: "ps-plainfield",
} as const satisfies Record<string, IndianaCcdSeedSchoolId>;

const PRIVATE_LEGACY_IDENTITIES: Record<
  ManualClassificationSeedSchoolId,
  { legacyNcesId: string; code: string }
> = {
  "ps-brebeuf": { legacyNcesId: "A0019840", code: "BRE" },
  "ps-cathedral": { legacyNcesId: "A0019841", code: "CTH" },
  "ps-bishop": { legacyNcesId: "A0019842", code: "BCH" },
};

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required.");
  const apply = args.has("--apply");
  if (apply) {
    assert(
      args.has("--confirm-dev-db"),
      "Refusing to mutate data without --confirm-dev-db.",
    );
  }

  console.log(`Seed-school identity repair (${apply ? "APPLY" : "DRY RUN"})`);
  console.log(`Database: ${describeDatabase(process.env.DATABASE_URL)}`);

  for (const repair of PUBLIC_REPAIRS) {
    await repairPublicSchool(repair, apply);
  }
  await repairMichiganCityPlainfieldCollision(apply);

  for (const seedSchoolId of Object.keys(
    MANUAL_SCHOOL_CLASSIFICATION_FIXTURES,
  ) as ManualClassificationSeedSchoolId[]) {
    await repairManualSchool(seedSchoolId, apply);
  }

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply --confirm-dev-db to commit this plan.");
    return;
  }

  const seasons = await prisma.season.findMany({
    where: { league: { divisionRules: { some: {} } } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  for (const season of seasons) {
    const result = await classifySeasonMemberSchools({ seasonId: season.id, db: prisma });
    console.log(`  reclassified ${result.classified} schools for ${season.name}`);
  }

  console.log("\nSeed-school identity repair completed.");
}

async function repairPublicSchool(repair: PublicRepair, apply: boolean) {
  const fixture = INDIANA_CCD_SCHOOL_FIXTURES[repair.seedSchoolId];
  const platformSchool = requirePlatformSchool(repair.seedSchoolId);
  const target = await requireCcdTarget(repair.seedSchoolId);
  const legacy = await findSingleLegacySchool(repair);

  if (!legacy) {
    console.log(`  ✓ ${fixture.officialName}: no legacy duplicate remains`);
    return;
  }
  if (legacy.id === target.id) {
    console.log(`  ✓ ${fixture.officialName}: already uses the CCD record`);
    return;
  }

  assertNoImportedTargetDependents(target);
  assert(
    legacy._count.enrollments === 0,
    `${legacy.name} has legacy enrollment rows; merge requires a manual review.`,
  );
  console.log(
    `  ${apply ? "→" : "•"} ${legacy.name} (${legacy.id}) -> ` +
      `${fixture.officialName} (${fixture.externalId})`,
  );
  if (!apply) return;

  await prisma.$transaction(
    async (tx) => {
      await moveSchoolDependents(tx, legacy.id, target.id);
      await tx.school.update({
        where: { id: target.id },
        data: {
          name: fixture.officialName,
          shortName: platformSchool.shortName,
          code: platformSchool.code,
          primaryColor: platformSchool.primaryColor,
        },
      });
      await tx.school.delete({ where: { id: legacy.id } });
      await writeMergeAudit(tx, legacy, target.id, fixture.externalId);
    },
    transactionOptions(),
  );
}

async function repairMichiganCityPlainfieldCollision(apply: boolean) {
  const legacy = await prisma.school.findUnique({
    where: { ncesId: COLLIDED_LEGACY_NCES_ID },
    select: schoolRepairSelect,
  });
  const michiganCity = await requireCcdTarget("ps-mchs");
  const plainfield = await requireCcdTarget("ps-plainfield");

  if (!legacy) {
    console.log("  ✓ Michigan City / Plainfield: collided legacy row is gone");
    return;
  }
  assert(legacy.directorySource === "MANUAL", "The collided row is not a manual seed row.");
  assertNoImportedTargetDependents(michiganCity);
  assertNoImportedTargetDependents(plainfield);
  assert(
    legacy._count.enrollments === 0 &&
      legacy._count.memberships === 0 &&
      legacy._count.teams === 0 &&
      legacy._count.invites === 0 &&
      legacy._count.applications === 0 &&
      legacy._count.agreementAcceptances === 0 &&
      legacy._count.studentConsents === 0 &&
      legacy._count.studentDataRequests === 0,
    "The Michigan City / Plainfield collision has unexpected dependents; manual review is required.",
  );

  const memberships = await prisma.leagueMembership.findMany({
    where: { schoolId: legacy.id },
    select: { id: true, league: { select: { slug: true } } },
  });
  const classifications = await prisma.seasonSchoolClassification.findMany({
    where: { schoolId: legacy.id },
    select: { id: true, season: { select: { league: { select: { slug: true } } } } },
  });
  for (const slug of [
    ...memberships.map((row) => row.league.slug),
    ...classifications.map((row) => row.season.league.slug),
  ]) {
    assert(
      slug in COLLISION_TARGET_BY_LEAGUE_SLUG,
      `The collided school is referenced by unexpected league "${slug}".`,
    );
  }

  console.log(
    `  ${apply ? "→" : "•"} split collided ${legacy.name} row into ` +
      "Michigan City (RIEL) and Plainfield (HEA)",
  );
  if (!apply) return;

  await prisma.$transaction(
    async (tx) => {
      for (const membership of memberships) {
        const targetId = targetIdForLeagueSlug(
          membership.league.slug,
          michiganCity.id,
          plainfield.id,
        );
        await tx.leagueMembership.update({
          where: { id: membership.id },
          data: { schoolId: targetId },
        });
      }
      for (const classification of classifications) {
        const targetId = targetIdForLeagueSlug(
          classification.season.league.slug,
          michiganCity.id,
          plainfield.id,
        );
        await tx.seasonSchoolClassification.update({
          where: { id: classification.id },
          data: { schoolId: targetId },
        });
      }

      const rielLeague = await tx.league.findUniqueOrThrow({
        where: { slug: "riel" },
        select: { id: true },
      });
      const heaLeague = await tx.league.findUniqueOrThrow({
        where: { slug: "hea" },
        select: { id: true },
      });
      await tx.auditLog.updateMany({
        where: { schoolId: legacy.id, leagueId: heaLeague.id },
        data: { schoolId: plainfield.id },
      });
      await tx.auditLog.updateMany({
        where: {
          schoolId: legacy.id,
          OR: [{ leagueId: rielLeague.id }, { leagueId: null }],
        },
        data: { schoolId: michiganCity.id },
      });

      await updateTargetBrand(tx, "ps-mchs", michiganCity.id);
      await updateTargetBrand(tx, "ps-plainfield", plainfield.id);
      await tx.school.delete({ where: { id: legacy.id } });
      await writeMergeAudit(tx, legacy, michiganCity.id, michiganCity.externalId);
      await writeMergeAudit(tx, legacy, plainfield.id, plainfield.externalId);
    },
    transactionOptions(),
  );
}

async function repairManualSchool(
  seedSchoolId: ManualClassificationSeedSchoolId,
  apply: boolean,
) {
  const fixture = MANUAL_SCHOOL_CLASSIFICATION_FIXTURES[seedSchoolId];
  const legacyIdentity = PRIVATE_LEGACY_IDENTITIES[seedSchoolId];
  const platformSchool = requirePlatformSchool(seedSchoolId);
  const matches = await prisma.school.findMany({
    where: {
      directorySource: "MANUAL",
      OR: [
        { id: seedSchoolId },
        { ncesId: legacyIdentity.legacyNcesId },
        { code: legacyIdentity.code },
      ],
    },
    take: 2,
    select: {
      id: true,
      ncesId: true,
      directorySource: true,
      externalId: true,
      level: true,
      enrollments: {
        where: {
          schoolYear: fixture.schoolYear,
          source: "LEAGUE_ADMIN",
          scope: "GRADES_9_12",
        },
        take: 1,
        select: { enrollment: true, notes: true },
      },
    },
  });
  assert(matches.length <= 1, `${platformSchool.name} has multiple manual seed records.`);
  const school = matches[0];
  assert(school, `Manual seed school ${platformSchool.name} was not found.`);
  const seededEnrollment = school.enrollments[0];
  const alreadyRepaired =
    school.ncesId === null &&
    school.directorySource === "MANUAL" &&
    school.externalId === null &&
    school.level === fixture.level &&
    seededEnrollment?.enrollment === fixture.grades912Enrollment &&
    seededEnrollment.notes === SYNTHETIC_ENROLLMENT_NOTE;
  if (alreadyRepaired) {
    console.log(`  ✓ ${platformSchool.name}: manual classification data is current`);
    return;
  }

  console.log(
    `  ${apply ? "→" : "•"} ${platformSchool.name}: clear fake NCES identity; ` +
      `seed HIGH / ${fixture.grades912Enrollment}`,
  );
  if (!apply) return;

  await prisma.$transaction(
    async (tx) => {
      await tx.school.update({
        where: { id: school.id },
        data: {
          name: platformSchool.name,
          shortName: platformSchool.shortName,
          code: platformSchool.code,
          city: platformSchool.city,
          state: platformSchool.state,
          primaryColor: platformSchool.primaryColor,
          ncesId: null,
          directorySource: "MANUAL",
          externalId: null,
          level: fixture.level,
          districtName: null,
          districtExternalId: null,
          streetAddress: null,
          zip: null,
          lowGrade: null,
          highGrade: null,
          datasetRelease: null,
          importedAt: null,
        },
      });
      await tx.schoolEnrollment.upsert({
        where: {
          schoolId_schoolYear_source_scope: {
            schoolId: school.id,
            schoolYear: fixture.schoolYear,
            source: "LEAGUE_ADMIN",
            scope: "GRADES_9_12",
          },
        },
        update: {
          enrollment: fixture.grades912Enrollment,
          notes: SYNTHETIC_ENROLLMENT_NOTE,
        },
        create: {
          schoolId: school.id,
          schoolYear: fixture.schoolYear,
          enrollment: fixture.grades912Enrollment,
          source: "LEAGUE_ADMIN",
          scope: "GRADES_9_12",
          notes: SYNTHETIC_ENROLLMENT_NOTE,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: "SCHOOL.SEED_IDENTITY_REPAIR",
          entityType: "School",
          entityId: school.id,
          before: { ncesId: school.ncesId, level: school.level },
          after: {
            directorySource: "MANUAL",
            ncesId: null,
            level: fixture.level,
            grades912Enrollment: fixture.grades912Enrollment,
            schoolYear: fixture.schoolYear,
          },
          schoolId: school.id,
        },
      });
    },
    transactionOptions(),
  );
}

async function findSingleLegacySchool(repair: PublicRepair) {
  const matches = await prisma.school.findMany({
    where: {
      directorySource: "MANUAL",
      ...(repair.legacyNcesId ? { ncesId: repair.legacyNcesId } : {}),
      ...(repair.legacyCode ? { code: repair.legacyCode } : {}),
    },
    take: 2,
    select: schoolRepairSelect,
  });
  assert(matches.length <= 1, `${repair.seedSchoolId} has multiple legacy rows.`);
  return matches[0] ?? null;
}

async function requireCcdTarget(seedSchoolId: IndianaCcdSeedSchoolId) {
  const fixture = INDIANA_CCD_SCHOOL_FIXTURES[seedSchoolId];
  const target = await prisma.school.findUnique({
    where: {
      directorySource_externalId: {
        directorySource: "CCD",
        externalId: fixture.externalId,
      },
    },
    select: schoolRepairSelect,
  });
  assert(target, `CCD target ${fixture.externalId} (${fixture.officialName}) is missing.`);
  assert(
    target.name === fixture.officialName && target.city === fixture.city,
    `CCD target ${fixture.externalId} does not match the verified name/city.`,
  );
  assert(target.level === "HIGH", `CCD target ${fixture.externalId} is not a high school.`);
  assert(target._count.enrollments > 0, `CCD target ${fixture.externalId} has no enrollment data.`);
  return target;
}

function assertNoImportedTargetDependents(target: SchoolRepairRow) {
  const counts = target._count;
  const unexpected = Object.entries(counts).filter(
    ([key, count]) => key !== "enrollments" && count > 0,
  );
  assert(
    unexpected.length === 0,
    `${target.name} already has dependents (${unexpected
      .map(([key, count]) => `${key}:${count}`)
      .join(", ")}); refusing an ambiguous merge.`,
  );
}

async function moveSchoolDependents(
  tx: Prisma.TransactionClient,
  sourceSchoolId: string,
  targetSchoolId: string,
) {
  await tx.leagueMembership.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.schoolMembership.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.team.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.invite.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.schoolApplication.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.studentConsent.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.studentDataRequest.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.agreementAcceptance.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.seasonSchoolClassification.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
  await tx.auditLog.updateMany({
    where: { schoolId: sourceSchoolId },
    data: { schoolId: targetSchoolId },
  });
}

async function updateTargetBrand(
  tx: Prisma.TransactionClient,
  seedSchoolId: IndianaCcdSeedSchoolId,
  targetId: string,
) {
  const fixture = INDIANA_CCD_SCHOOL_FIXTURES[seedSchoolId];
  const platformSchool = requirePlatformSchool(seedSchoolId);
  await tx.school.update({
    where: { id: targetId },
    data: {
      name: fixture.officialName,
      shortName: platformSchool.shortName,
      code: platformSchool.code,
      primaryColor: platformSchool.primaryColor,
    },
  });
}

async function writeMergeAudit(
  tx: Prisma.TransactionClient,
  legacy: SchoolRepairRow,
  targetId: string,
  externalId: string | null,
) {
  await tx.auditLog.create({
    data: {
      actorUserId: null,
      action: "SCHOOL.SEED_IDENTITY_MERGE",
      entityType: "School",
      entityId: targetId,
      before: {
        id: legacy.id,
        name: legacy.name,
        ncesId: legacy.ncesId,
        directorySource: legacy.directorySource,
      },
      after: {
        id: targetId,
        directorySource: "CCD",
        externalId,
      },
      metadata: { reason: "Explicit local/demo seed identity repair" },
      schoolId: targetId,
    },
  });
}

function targetIdForLeagueSlug(
  slug: string,
  michiganCityId: string,
  plainfieldId: string,
) {
  if (slug === "riel") return michiganCityId;
  if (slug === "hea") return plainfieldId;
  throw new Error(`No collision target configured for league "${slug}".`);
}

function requirePlatformSchool(seedSchoolId: string) {
  const school = platformSchoolById(seedSchoolId);
  assert(school, `Missing platform seed school ${seedSchoolId}.`);
  return school;
}

function transactionOptions() {
  return {
    maxWait: 5_000,
    timeout: 30_000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  } as const;
}

function describeDatabase(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    return `${url.protocol}//${url.hostname}:${url.port || "default"}${url.pathname}`;
  } catch {
    return "configured development database";
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const schoolRepairSelect = {
  id: true,
  name: true,
  city: true,
  ncesId: true,
  directorySource: true,
  externalId: true,
  level: true,
  _count: {
    select: {
      leagueMemberships: true,
      memberships: true,
      teams: true,
      invites: true,
      applications: true,
      agreementAcceptances: true,
      enrollments: true,
      seasonClassifications: true,
      studentConsents: true,
      studentDataRequests: true,
    },
  },
} satisfies Prisma.SchoolSelect;

type SchoolRepairRow = Prisma.SchoolGetPayload<{ select: typeof schoolRepairSelect }>;

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
