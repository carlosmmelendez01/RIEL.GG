/**
 * Sent to a recipient when a school MANAGER or COACH issues them an invite
 * (createSchoolInvite with intendedEmail set). For open links — no
 * intendedEmail — we don't have an address, so we skip the email.
 */

import {
  Body14,
  DetailBlock,
  DetailRow,
  EmailLayout,
  H1,
  Muted12,
  PrimaryButton,
} from "@/lib/email/templates/_layout";

const ROLE_LABEL: Record<"MANAGER" | "COACH" | "PLAYER", string> = {
  MANAGER: "Manager",
  COACH: "Coach",
  PLAYER: "Player",
};

export function SchoolInviteCreated({
  inviterName,
  schoolName,
  role,
  claimUrl,
  expiresAt,
  grantsOwnership,
}: {
  inviterName: string;
  schoolName: string;
  role: "MANAGER" | "COACH" | "PLAYER";
  claimUrl: string;
  expiresAt: Date;
  grantsOwnership: boolean;
}) {
  const roleLabel = ROLE_LABEL[role];
  const preview = `${inviterName} invited you to ${schoolName} as ${roleLabel}.`;
  const expires = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <EmailLayout preview={preview}>
      <H1>You&apos;re invited to {schoolName}.</H1>
      <Body14>
        {inviterName} added you to {schoolName} as a {roleLabel.toLowerCase()}
        {grantsOwnership ? " — and is passing you ownership of the school." : "."} Click the
        button below to set up your account and join.
      </Body14>
      <PrimaryButton href={claimUrl}>Accept invitation</PrimaryButton>
      <DetailBlock>
        <DetailRow label="School" value={schoolName} />
        <DetailRow label="Role" value={roleLabel} />
        {grantsOwnership ? <DetailRow label="Ownership" value="Yes" /> : null}
        <DetailRow label="Expires" value={expires} />
      </DetailBlock>
      <Muted12>
        This invite is locked to your email address. If you didn&apos;t expect it, ignore
        this message — it&apos;ll expire on its own.
      </Muted12>
    </EmailLayout>
  );
}

export function schoolInviteCreatedText(args: {
  inviterName: string;
  schoolName: string;
  role: string;
  claimUrl: string;
}): string {
  return `${args.inviterName} invited you to ${args.schoolName} as ${args.role}.

Accept here: ${args.claimUrl}

— RIEL.GG`;
}
