/**
 * School directory data layer (coach-side).
 *
 * Powers /dashboard/school. Scoped to the viewer's school context — only
 * returns data when they're a COACH or MANAGER at the school. Players
 * see nothing here (they don't manage rosters).
 */

import { prisma } from "@/lib/db/prisma";

export type SchoolMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "MANAGER" | "COACH" | "PLAYER";
  isOwner: boolean;
  joinedAt: Date;
};

export type SchoolOutstandingInvite = {
  id: string;
  code: string;
  url: string;
  role: "MANAGER" | "COACH" | "PLAYER";
  intendedEmail: string | null;
  maxUses: number;
  usedCount: number;
  grantsOwnership: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  createdByName: string | null;
};

export type SchoolPageData = {
  school: {
    id: string;
    name: string;
    shortName: string | null;
    city: string | null;
    state: string | null;
  };
  viewerRole: "MANAGER" | "COACH";
  isOwner: boolean;
  members: SchoolMember[];
  outstandingInvites: SchoolOutstandingInvite[];
};

/**
 * Resolves the viewer's "active" school. Most coaches are at one school,
 * so we just grab their first COACH/MANAGER membership. Multi-school
 * coaches will get a switcher in a later pass.
 */
export async function resolveActiveSchool(
  userId: string,
): Promise<{ schoolId: string; role: "MANAGER" | "COACH"; isOwner: boolean } | null> {
  const m = await prisma.schoolMembership.findFirst({
    where: { userId, role: { in: ["MANAGER", "COACH"] } },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
    select: { schoolId: true, role: true, isOwner: true },
  });
  if (!m) return null;
  return {
    schoolId: m.schoolId,
    role: m.role as "MANAGER" | "COACH",
    isOwner: m.isOwner,
  };
}

/**
 * Full payload for /dashboard/school. Returns null when the viewer doesn't
 * have COACH/MANAGER membership at the requested school. Caller should
 * render the no-access empty state in that case.
 */
export async function loadCoachSchoolPage(
  userId: string,
  schoolId: string,
): Promise<SchoolPageData | null> {
  const me = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
    select: { role: true, isOwner: true },
  });
  if (!me) return null;
  if (me.role !== "MANAGER" && me.role !== "COACH") return null;

  const [school, memberships, invites] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        shortName: true,
        city: true,
        state: true,
      },
    }),
    prisma.schoolMembership.findMany({
      where: { schoolId, detached: false },
      orderBy: [{ isOwner: "desc" }, { role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        role: true,
        isOwner: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.invite.findMany({
      where: { schoolId, scope: "SCHOOL", status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        rolesGranted: true,
        intendedEmail: true,
        maxUses: true,
        usedCount: true,
        grantsOwnership: true,
        expiresAt: true,
        createdAt: true,
        createdBy: { select: { fullName: true } },
      },
    }),
  ]);
  if (!school) return null;

  return {
    school,
    viewerRole: me.role as "MANAGER" | "COACH",
    isOwner: me.isOwner,
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: m.user.fullName,
      email: m.user.email,
      role: m.role as "MANAGER" | "COACH" | "PLAYER",
      isOwner: m.isOwner,
      joinedAt: m.createdAt,
    })),
    outstandingInvites: invites.map((i) => {
      const role =
        (i.rolesGranted.find((r) =>
          ["MANAGER", "COACH", "PLAYER"].includes(r),
        ) as "MANAGER" | "COACH" | "PLAYER" | undefined) ?? "PLAYER";
      return {
        id: i.id,
        code: i.code,
        url: `/claim/${i.code}`,
        role,
        intendedEmail: i.intendedEmail,
        maxUses: i.maxUses,
        usedCount: i.usedCount,
        grantsOwnership: i.grantsOwnership,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        createdByName: i.createdBy?.fullName ?? null,
      };
    }),
  };
}
