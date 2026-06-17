import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgreementAcceptanceForm } from "@/components/compliance/agreement-acceptance-form";
import {
  AgreementAlreadyAccepted,
  AgreementBlocked,
  AgreementPageShell,
} from "@/components/compliance/agreement-page-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadLeagueAgreementStatus } from "@/lib/compliance/agreements";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "League Agreement · RIEL.GG",
};

export default async function LeagueAgreementPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/agreements/league/${leagueId}`)}`);

  const adminship = await prisma.leagueAdminship.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    select: {
      role: true,
      league: { select: { id: true, name: true, slug: true } },
    },
  });

  const leagueName = adminship?.league.name ?? "League agreement";

  return (
    <AgreementPageShell
      eyebrow="League operator"
      title={leagueName}
      body="A league owner or admin must accept the operator agreement before league administration opens."
    >
      {!adminship || (adminship.role !== "OWNER" && adminship.role !== "ADMIN") ? (
        <AgreementBlocked
          title="League owner or admin required"
          body="Only a league owner or admin can accept this agreement. Staff can continue after an authorized league representative signs."
        />
      ) : (
        <LeagueAgreementContent
          leagueId={adminship.league.id}
          leagueName={adminship.league.name}
          userName={user.fullName}
          userEmail={user.email}
        />
      )}
    </AgreementPageShell>
  );
}

async function LeagueAgreementContent({
  leagueId,
  leagueName,
  userName,
  userEmail,
}: {
  leagueId: string;
  leagueName: string;
  userName: string;
  userEmail: string;
}) {
  const status = await loadLeagueAgreementStatus(leagueId);
  if (status.accepted) {
    return (
      <AgreementAlreadyAccepted
        title="League agreement already accepted"
        body={`${leagueName} has the current agreement version on file. You can continue to the league admin dashboard.`}
        href="/admin"
        label="Open admin dashboard"
      />
    );
  }

  return (
    <AgreementAcceptanceForm
      kind="league"
      entityId={leagueId}
      entityName={leagueName}
      signerName={userName}
      signerEmail={userEmail}
    />
  );
}
