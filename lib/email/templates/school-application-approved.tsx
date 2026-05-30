/**
 * Sent to the coach who applied via /join, once a league admin approves the
 * application. Carries the claim link they need to set up the school's
 * ownership.
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

export function SchoolApplicationApproved({
  coachName,
  schoolName,
  leagueName,
  claimUrl,
  expiresAt,
}: {
  coachName: string;
  schoolName: string;
  leagueName: string;
  claimUrl: string;
  expiresAt: Date;
}) {
  const preview = `${schoolName} is approved for ${leagueName}. Claim your account.`;
  const expires = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <EmailLayout preview={preview}>
      <H1>{schoolName} is in.</H1>
      <Body14>
        Hi {coachName}, {leagueName} approved your application. Use the link below to claim
        ownership of {schoolName} and set up your roster.
      </Body14>
      <PrimaryButton href={claimUrl}>Claim {schoolName}</PrimaryButton>
      <DetailBlock>
        <DetailRow label="School" value={schoolName} />
        <DetailRow label="League" value={leagueName} />
        <DetailRow label="Expires" value={expires} />
      </DetailBlock>
      <Muted12>
        This link is for you only. If you didn&apos;t apply, ignore this email.
      </Muted12>
    </EmailLayout>
  );
}

export function schoolApplicationApprovedText(args: {
  coachName: string;
  schoolName: string;
  leagueName: string;
  claimUrl: string;
}): string {
  return `Hi ${args.coachName},

${args.leagueName} approved your application — ${args.schoolName} is in.

Claim your school: ${args.claimUrl}

— RIEL.GG`;
}
