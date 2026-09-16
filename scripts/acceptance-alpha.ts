import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import type { PrismaClient } from "@prisma/client";

type CleanupIds = {
  leagueId?: string;
  applicationId?: string;
  inviteId?: string;
  agreementId?: string;
  teamId?: string;
  rosterId?: string;
  userIds: string[];
};

const args = new Set(process.argv.slice(2));

async function main() {
  loadEnvFiles();
  assert(process.env.DATABASE_URL, "DATABASE_URL is required.");
  assert(
    args.has("--confirm-dev-db"),
    "Refusing to run without --confirm-dev-db. Point DATABASE_URL at a development database, then rerun.",
  );

  const [
    { PrismaClient },
    { classifySeasonSchool },
    { loadCompetitionDecisionsForTeam },
    { registerTeamForCompetitionForUser },
    { SCHOOL_PARTICIPATION_AGREEMENT_VERSION },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../lib/classification/season-service"),
    import("../lib/coach/dashboard"),
    import("../lib/team/registration-service"),
    import("../lib/compliance/agreements"),
  ]);

  const prisma = new PrismaClient();
  const cleanup: CleanupIds = { userIds: [] };

  try {
    console.log(`Acceptance alpha database: ${describeDatabase(process.env.DATABASE_URL)}`);
    const runId = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);

    const school = await prisma.school.findFirst({
      where: {
        directorySource: "CCD",
        externalId: { not: null },
        level: "HIGH",
        enrollments: {
          some: {
            scope: "GRADES_9_12",
            enrollment: { gt: 0 },
          },
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        city: true,
        state: true,
        externalId: true,
        ncesId: true,
        enrollments: {
          where: { scope: "GRADES_9_12" },
          orderBy: [{ schoolYear: "desc" }, { importedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { id: true, enrollment: true, schoolYear: true },
        },
      },
    });
    assert(
      school?.externalId && school.enrollments[0],
      "No CCD high school with grades 9-12 enrollment exists. Run the NCES importer against this database first.",
    );
    ok(`selected CCD school: ${school.name} (${school.externalId})`);

    const admin = await prisma.user.create({
      data: {
        authId: `acceptance:${runId}:admin`,
        email: `acceptance.admin.${runId}@riel.test`,
        fullName: "Acceptance Admin",
      },
      select: { id: true, email: true, fullName: true },
    });
    const coach = await prisma.user.create({
      data: {
        authId: `acceptance:${runId}:coach`,
        email: `acceptance.coach.${runId}@riel.test`,
        fullName: "Acceptance Coach",
      },
      select: { id: true, email: true, fullName: true },
    });
    const player = await prisma.user.create({
      data: {
        authId: `acceptance:${runId}:player`,
        email: `acceptance.player.${runId}@riel.test`,
        fullName: "Acceptance Player",
      },
      select: { id: true },
    });
    cleanup.userIds.push(admin.id, coach.id, player.id);

    const league = await prisma.league.create({
      data: {
        name: `Acceptance Alpha ${runId}`,
        slug: `acceptance-alpha-${runId}`,
        description: "Disposable acceptance-test league.",
        primaryColor: "#A51C30",
      },
      select: { id: true, name: true },
    });
    cleanup.leagueId = league.id;

    await prisma.leagueAdminship.create({
      data: { leagueId: league.id, userId: admin.id, role: "OWNER" },
    });

    const season = await prisma.season.create({
      data: {
        leagueId: league.id,
        name: `Acceptance Season ${runId}`,
        startsAt: new Date("2026-09-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z"),
      },
      select: { id: true },
    });

    const [oneA, twoA] = await Promise.all([
      prisma.division.create({
        data: { leagueId: league.id, name: "1A", slug: "1a", sortOrder: 0 },
        select: { id: true, name: true },
      }),
      prisma.division.create({
        data: { leagueId: league.id, name: "2A", slug: "2a", sortOrder: 1 },
        select: { id: true, name: true },
      }),
    ]);

    const ruleStart = new Date("2026-01-01T00:00:00.000Z");
    await prisma.divisionRule.createMany({
      data: [
        {
          leagueId: league.id,
          divisionId: oneA.id,
          schoolLevel: "HIGH",
          enrollmentScope: "GRADES_9_12",
          minimumEnrollment: 0,
          maximumEnrollment: 900,
          effectiveFrom: ruleStart,
        },
        {
          leagueId: league.id,
          divisionId: twoA.id,
          schoolLevel: "HIGH",
          enrollmentScope: "GRADES_9_12",
          minimumEnrollment: 901,
          maximumEnrollment: null,
          effectiveFrom: ruleStart,
        },
        {
          leagueId: league.id,
          divisionId: null,
          schoolLevel: "MIDDLE",
          enrollmentScope: "GRADES_9_12",
          minimumEnrollment: null,
          maximumEnrollment: null,
          effectiveFrom: ruleStart,
        },
      ],
    });
    ok("created disposable league, season, divisions, and rules as data");

    const application = await prisma.schoolApplication.create({
      data: {
        leagueId: league.id,
        schoolId: school.id,
        schoolName: school.name,
        schoolShort: school.shortName,
        schoolCity: school.city,
        schoolState: school.state,
        schoolCode: school.code,
        ncesId: school.externalId,
        coachName: coach.fullName,
        coachEmail: coach.email,
        coachRole: "Head Coach",
        reason: "Acceptance test application.",
      },
      select: { id: true },
    });
    cleanup.applicationId = application.id;
    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: "SCHOOL_APPLICATION.SUBMIT",
        entityType: "SchoolApplication",
        entityId: application.id,
        after: {
          leagueId: league.id,
          schoolId: school.id,
          ncesId: school.externalId,
          coachEmail: coach.email,
        },
        leagueId: league.id,
        schoolId: school.id,
      },
    });
    ok("coach submitted application for an existing CCD school");

    const approval = await approveApplicationOnce(prisma, {
      applicationId: application.id,
      leagueId: league.id,
      schoolId: school.id,
      adminUserId: admin.id,
      coachEmail: coach.email,
    });
    cleanup.inviteId = approval.inviteId;
    ok("one admin approval activated the school and issued a claim invite");

    await claimSchoolInvite(prisma, {
      inviteId: approval.inviteId,
      schoolId: school.id,
      coachUserId: coach.id,
    });
    ok("coach claimed school ownership");

    const agreement = await prisma.agreementAcceptance.create({
      data: {
        type: "SCHOOL_PARTICIPATION",
        version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
        schoolId: school.id,
        acceptedById: coach.id,
        signerName: coach.fullName,
        signerTitle: "Head Coach",
        signerEmail: coach.email,
        coverageSource: "DIRECT_SCHOOL_AUTHORIZATION",
        attestations: { acceptanceTest: true, runId },
      },
      select: { id: true },
    });
    cleanup.agreementId = agreement.id;
    ok("school agreement accepted");

    const classification = await classifySeasonSchool({
      seasonId: season.id,
      schoolId: school.id,
      db: prisma,
    });
    assert(classification.status === "CLASSIFIED", classification.explanation);
    assert(
      classification.effectiveDivisionId,
      "Expected a concrete effective division for the selected high school.",
    );
    ok(
      `classified by grades 9-12 enrollment (${school.enrollments[0].enrollment}) as ${classification.effectiveDivision?.name}`,
    );

    const { game, format } = await ensureRocketLeague(prisma);
    const competition = await prisma.competition.create({
      data: {
        seasonId: season.id,
        name: `Acceptance Rocket League ${classification.effectiveDivision?.name}`,
        gameTitleId: game.id,
        gameFormatId: format.id,
        divisionId: classification.effectiveDivisionId,
        skillTier: "VARSITY",
        state: "ACTIVE",
        status: "SEEDING",
        registrationOpensAt: new Date("2026-08-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2026-12-01T00:00:00.000Z"),
        registrationRequiresApproval: false,
      },
      select: { id: true },
    });

    const team = await prisma.team.create({
      data: {
        schoolId: school.id,
        gameTitleId: game.id,
        gameFormatId: format.id,
        skillTier: "VARSITY",
        customName: "Acceptance Rocket League",
      },
      select: { id: true },
    });
    cleanup.teamId = team.id;
    await prisma.auditLog.create({
      data: {
        actorUserId: coach.id,
        action: "TEAM.CREATE",
        entityType: "Team",
        entityId: team.id,
        after: { schoolId: school.id, game: game.name, skillTier: "VARSITY" },
        schoolId: school.id,
      },
    });
    ok("coach created a team after school agreement acceptance");

    const decisions = await loadCompetitionDecisionsForTeam(coach.id, team.id);
    const decision = decisions.find((row) => row.competitionId === competition.id);
    assert(decision, "Coach competition screen did not return the acceptance competition.");
    assert(decision.eligible, decision.message);
    assert(
      decision.action.kind === "REGISTER_TEAM",
      `Expected REGISTER_TEAM action, got ${decision.action.kind}.`,
    );
    assertNoDeadEndCopy(decision.message);
    ok("coach sees an eligible competition decision with REGISTER_TEAM");

    const registration = await registerTeamForCompetitionForUser({
      userId: coach.id,
      teamId: team.id,
      competitionId: competition.id,
      db: prisma,
    });
    assert(registration.ok, registration.ok ? "" : registration.error);
    cleanup.rosterId = registration.rosterId;
    assert(
      registration.registrationStatus === "APPROVED",
      `Expected immediate APPROVED registration, got ${registration.registrationStatus}.`,
    );
    ok("team registered immediately with no second admin approval");

    await prisma.rosterMembership.create({
      data: {
        rosterId: registration.rosterId,
        userId: player.id,
        role: "PLAYER",
        jerseyNumber: 1,
        inGameName: "AcceptancePlayer",
        isStarter: true,
      },
    });
    ok("coach built a roster with a synthetic player");

    console.log("\nAcceptance alpha passed.");
  } finally {
    if (!args.has("--keep-data")) {
      await cleanupRun(prisma, cleanup);
      console.log("Cleaned up disposable acceptance data. Use --keep-data to inspect a run.");
    }
    await prisma.$disconnect();
  }
}

function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

async function approveApplicationOnce(
  prisma: PrismaClient,
  input: {
    applicationId: string;
    leagueId: string;
    schoolId: string;
    adminUserId: string;
    coachEmail: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.leagueMembership.upsert({
      where: {
        leagueId_schoolId: {
          leagueId: input.leagueId,
          schoolId: input.schoolId,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        leagueId: input.leagueId,
        schoolId: input.schoolId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    const invite = await tx.invite.create({
      data: {
        code: inviteCode(),
        scope: "SCHOOL",
        schoolId: input.schoolId,
        createdById: input.adminUserId,
        rolesGranted: ["MANAGER"],
        grantsOwnership: true,
        intendedEmail: input.coachEmail,
        maxUses: 1,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await tx.schoolApplication.update({
      where: { id: input.applicationId },
      data: {
        status: "APPROVED",
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        reviewerNotes: "Acceptance test approval.",
        schoolId: input.schoolId,
        resultMembershipId: membership.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.adminUserId,
        action: "SCHOOL_APPLICATION.APPROVE",
        entityType: "SchoolApplication",
        entityId: input.applicationId,
        before: { status: "PENDING" },
        after: {
          status: "APPROVED",
          schoolId: input.schoolId,
          leagueMembershipId: membership.id,
        },
        leagueId: input.leagueId,
        schoolId: input.schoolId,
      },
    });

    return { inviteId: invite.id, membershipId: membership.id };
  });
}

async function claimSchoolInvite(
  prisma: PrismaClient,
  input: {
    inviteId: string;
    schoolId: string;
    coachUserId: string;
  },
) {
  await prisma.$transaction(async (tx) => {
    await tx.invite.update({
      where: { id: input.inviteId },
      data: { usedCount: 1, status: "EXHAUSTED" },
    });

    await tx.schoolMembership.upsert({
      where: {
        schoolId_userId: {
          schoolId: input.schoolId,
          userId: input.coachUserId,
        },
      },
      update: { role: "MANAGER", isOwner: true, detached: false },
      create: {
        schoolId: input.schoolId,
        userId: input.coachUserId,
        role: "MANAGER",
        isOwner: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.coachUserId,
        action: "INVITE.ACCEPT_SCHOOL",
        entityType: "Invite",
        entityId: input.inviteId,
        before: { status: "ACTIVE", usedCount: 0 },
        after: { status: "EXHAUSTED", usedCount: 1 },
        metadata: { role: "MANAGER", isOwner: true, schoolId: input.schoolId },
        schoolId: input.schoolId,
      },
    });
  });
}

async function ensureRocketLeague(prisma: PrismaClient) {
  const game = await prisma.gameTitle.upsert({
    where: { slug: "rl" },
    update: { name: "Rocket League", publisher: "Psyonix", active: true },
    create: { slug: "rl", name: "Rocket League", publisher: "Psyonix", active: true },
    select: { id: true, name: true },
  });

  const format = await prisma.gameFormat.upsert({
    where: { gameTitleId_name: { gameTitleId: game.id, name: "3v3" } },
    update: { playerCount: 3 },
    create: { gameTitleId: game.id, name: "3v3", playerCount: 3 },
    select: { id: true },
  });

  return { game, format };
}

async function cleanupRun(prisma: PrismaClient, ids: CleanupIds) {
  if (ids.rosterId) {
    await prisma.rosterMembership.deleteMany({ where: { rosterId: ids.rosterId } });
    await prisma.roster.deleteMany({ where: { id: ids.rosterId } });
  }
  if (ids.teamId) {
    await prisma.team.deleteMany({ where: { id: ids.teamId } });
  }
  if (ids.agreementId) {
    await prisma.agreementAcceptance.deleteMany({ where: { id: ids.agreementId } });
  }
  if (ids.inviteId) {
    await prisma.invite.deleteMany({ where: { id: ids.inviteId } });
  }
  if (ids.applicationId) {
    await prisma.schoolApplication.deleteMany({ where: { id: ids.applicationId } });
  }
  if (ids.leagueId) {
    await prisma.league.deleteMany({ where: { id: ids.leagueId } });
  }
  if (ids.userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  }
}

function inviteCode() {
  return `acceptance-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function assertNoDeadEndCopy(message: string) {
  assert(!/contact (the )?league admin/i.test(message), `Dead-end copy found: ${message}`);
}

function ok(message: string) {
  console.log(`[ok] ${message}`);
}

function describeDatabase(rawUrl: string | undefined) {
  if (!rawUrl) return "unknown";
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "unparseable DATABASE_URL";
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
