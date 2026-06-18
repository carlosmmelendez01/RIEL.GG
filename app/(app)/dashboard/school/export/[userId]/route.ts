import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  const { userId } = await params;

  const managerSchools = await prisma.schoolMembership.findMany({
    where: { userId: viewer.id, role: "MANAGER", detached: false },
    select: { schoolId: true, school: { select: { name: true, shortName: true } } },
  });
  if (managerSchools.length === 0) return new NextResponse("Forbidden", { status: 403 });

  const schoolIds = managerSchools.map((membership) => membership.schoolId);
  const subject = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, createdAt: true, updatedAt: true },
  });
  if (!subject) return new NextResponse("Not found", { status: 404 });

  const subjectSchool = await resolveSubjectSchool(userId, schoolIds);
  if (!subjectSchool) return new NextResponse("Forbidden", { status: 403 });

  const school =
    managerSchools.find((membership) => membership.schoolId === subjectSchool.schoolId)?.school ??
    subjectSchool.school;

  const [
    consent,
    schoolMemberships,
    rosterMemberships,
    checkIns,
    reports,
    messages,
    goals,
    comments,
    dataRequests,
  ] = await Promise.all([
    prisma.studentConsent.findUnique({
      where: { studentUserId_schoolId: { studentUserId: userId, schoolId: subjectSchool.schoolId } },
    }),
    prisma.schoolMembership.findMany({
      where: { userId, schoolId: subjectSchool.schoolId },
      select: { role: true, isOwner: true, detached: true, createdAt: true },
    }),
    prisma.rosterMembership.findMany({
      where: { userId, roster: { team: { schoolId: subjectSchool.schoolId } } },
      select: {
        role: true,
        jerseyNumber: true,
        inGameName: true,
        isStarter: true,
        createdAt: true,
        roster: {
          select: {
            id: true,
            competition: { select: { name: true } },
            team: { select: { customName: true, colorTag: true } },
          },
        },
      },
    }),
    prisma.matchCheckIn.findMany({
      where: { userId, roster: { team: { schoolId: subjectSchool.schoolId } } },
      select: { matchId: true, side: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.matchReport.findMany({
      where: { reportedByUserId: userId },
      select: { matchId: true, homeScore: true, awayScore: true, notes: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.matchMessage.findMany({
      where: {
        authorUserId: userId,
        match: {
          OR: [
            { homeRoster: { team: { schoolId: subjectSchool.schoolId } } },
            { awayRoster: { team: { schoolId: subjectSchool.schoolId } } },
          ],
        },
      },
      select: { matchId: true, kind: true, body: true, attachmentPath: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.playerGoal.findMany({
      where: { playerId: userId },
      select: { kind: true, label: true, targetValue: true, achievedAt: true, archivedAt: true, createdAt: true },
    }),
    prisma.playerComment.findMany({
      where: { playerId: userId },
      select: { kind: true, visibility: true, body: true, matchId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studentDataRequest.findMany({
      where: { subjectUserId: userId, schoolId: subjectSchool.schoolId },
      select: { type: true, status: true, reason: true, notes: true, completedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const exportRequest = await prisma.$transaction(async (tx) => {
    const row = await tx.studentDataRequest.create({
      data: {
        schoolId: subjectSchool.schoolId,
        subjectUserId: userId,
        requestedById: viewer.id,
        type: "EXPORT",
        status: "COMPLETED",
        completedAt: new Date(),
        reason: "School manager downloaded student data export.",
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: "STUDENT_PRIVACY.EXPORT_DOWNLOAD",
        entityType: "StudentDataRequest",
        entityId: row.id,
        after: { schoolId: subjectSchool.schoolId, studentUserId: userId, type: "EXPORT" },
        schoolId: subjectSchool.schoolId,
      },
    });
    return row;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    exportRequestId: exportRequest.id,
    school: {
      id: subjectSchool.schoolId,
      name: school.name,
      shortName: school.shortName,
    },
    student: subject,
    consent,
    schoolMemberships,
    rosterMemberships,
    matchCheckIns: checkIns,
    matchReports: reports,
    matchMessages: messages,
    playerGoals: goals,
    playerComments: comments,
    studentDataRequests: dataRequests,
  };

  const fileSafeName = subject.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename=\"arclight-student-export-${fileSafeName || userId}.json\"`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

async function resolveSubjectSchool(userId: string, schoolIds: string[]) {
  const schoolMembership = await prisma.schoolMembership.findFirst({
    where: { userId, schoolId: { in: schoolIds }, role: "PLAYER" },
    select: {
      schoolId: true,
      school: { select: { name: true, shortName: true } },
    },
  });
  if (schoolMembership) return schoolMembership;

  const rosterMembership = await prisma.rosterMembership.findFirst({
    where: {
      userId,
      role: { in: ["PLAYER", "CAPTAIN"] },
      roster: { team: { schoolId: { in: schoolIds } } },
    },
    select: {
      roster: {
        select: {
          team: {
            select: {
              schoolId: true,
              school: { select: { name: true, shortName: true } },
            },
          },
        },
      },
    },
  });
  if (!rosterMembership) return null;
  return {
    schoolId: rosterMembership.roster.team.schoolId,
    school: rosterMembership.roster.team.school,
  };
}
