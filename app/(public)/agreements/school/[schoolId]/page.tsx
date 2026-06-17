import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgreementAcceptanceForm } from "@/components/compliance/agreement-acceptance-form";
import {
  AgreementAlreadyAccepted,
  AgreementBlocked,
  AgreementPageShell,
} from "@/components/compliance/agreement-page-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadSchoolAgreementStatus } from "@/lib/compliance/agreements";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "School Agreement · RIEL.GG",
};

export default async function SchoolAgreementPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/agreements/school/${schoolId}`)}`);

  const membership = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId: user.id } },
    select: {
      role: true,
      isOwner: true,
      school: {
        select: {
          id: true,
          name: true,
          shortName: true,
          city: true,
          state: true,
        },
      },
    },
  });

  const schoolName = membership?.school.name ?? "School agreement";

  return (
    <AgreementPageShell
      eyebrow="School authorization"
      title={schoolName}
      body="Before school managers can continue, RIEL.GG needs a school participation and student data authorization acceptance on file."
    >
      {!membership || membership.role !== "MANAGER" ? (
        <AgreementBlocked
          title="Manager access required"
          body="Only a school manager or owner can accept this agreement. Ask the school owner, athletic director, or authorized program lead to sign in with their claim account."
        />
      ) : (
        <SchoolAgreementContent
          schoolId={membership.school.id}
          schoolName={membership.school.name}
          userName={user.fullName}
          userEmail={user.email}
        />
      )}
    </AgreementPageShell>
  );
}

async function SchoolAgreementContent({
  schoolId,
  schoolName,
  userName,
  userEmail,
}: {
  schoolId: string;
  schoolName: string;
  userName: string;
  userEmail: string;
}) {
  const status = await loadSchoolAgreementStatus(schoolId);
  if (status.accepted) {
    return (
      <AgreementAlreadyAccepted
        title="School agreement already accepted"
        body={`${schoolName} has the current agreement version on file. You can continue to the school dashboard.`}
        href="/dashboard/school"
        label="Open school dashboard"
      />
    );
  }

  return (
    <AgreementAcceptanceForm
      kind="school"
      entityId={schoolId}
      entityName={schoolName}
      signerName={userName}
      signerEmail={userEmail}
    />
  );
}
