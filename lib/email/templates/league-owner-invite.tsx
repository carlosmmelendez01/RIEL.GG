/**
 * Sent to the league owner when a platform admin provisions a new league
 * (createLeague) for an email that doesn't yet have an account. The owner
 * clicks through to /claim/[code], signs in, and is granted the league
 * OWNER adminship.
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

export function LeagueOwnerInvite({
  provisionedByName,
  leagueName,
  claimUrl,
  expiresAt,
}: {
  provisionedByName: string;
  leagueName: string;
  claimUrl: string;
  expiresAt: Date;
}) {
  const preview = `You've been made the owner of ${leagueName} on ArcLight.`;
  const expires = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <EmailLayout preview={preview}>
      <H1>{leagueName} is ready for you.</H1>
      <Body14>
        {provisionedByName} provisioned {leagueName} on ArcLight and named you its
        owner. Click below to sign in and take control — you&apos;ll be able to
        approve schools, create competitions, and run your seasons.
      </Body14>
      <PrimaryButton href={claimUrl}>Claim your league</PrimaryButton>
      <DetailBlock>
        <DetailRow label="League" value={leagueName} />
        <DetailRow label="Role" value="Owner" />
        <DetailRow label="Expires" value={expires} />
      </DetailBlock>
      <Muted12>
        This invite is locked to your email address. If you didn&apos;t expect it,
        ignore this message — it&apos;ll expire on its own.
      </Muted12>
    </EmailLayout>
  );
}

export function leagueOwnerInviteText(args: {
  provisionedByName: string;
  leagueName: string;
  claimUrl: string;
}): string {
  return `${args.provisionedByName} made you the owner of ${args.leagueName} on ArcLight.

Claim it here: ${args.claimUrl}

— ArcLight`;
}

/**
 * Sent when an existing league owner/admin invites another person onto the
 * league staff (createLeagueInvite). Works for any league role.
 */
export function LeagueAdminInvite({
  invitedByName,
  leagueName,
  roleLabel,
  claimUrl,
  expiresAt,
}: {
  invitedByName: string;
  leagueName: string;
  roleLabel: string;
  claimUrl: string;
  expiresAt: Date;
}) {
  const preview = `${invitedByName} invited you to help run ${leagueName} as ${roleLabel}.`;
  const expires = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <EmailLayout preview={preview}>
      <H1>You&apos;re invited to {leagueName}.</H1>
      <Body14>
        {invitedByName} added you to {leagueName} on ArcLight as {roleLabel}. Click below
        to sign in and join the league staff.
      </Body14>
      <PrimaryButton href={claimUrl}>Accept invitation</PrimaryButton>
      <DetailBlock>
        <DetailRow label="League" value={leagueName} />
        <DetailRow label="Role" value={roleLabel} />
        <DetailRow label="Expires" value={expires} />
      </DetailBlock>
      <Muted12>
        This invite is locked to your email address. If you didn&apos;t expect it,
        ignore this message — it&apos;ll expire on its own.
      </Muted12>
    </EmailLayout>
  );
}

export function leagueAdminInviteText(args: {
  invitedByName: string;
  leagueName: string;
  roleLabel: string;
  claimUrl: string;
}): string {
  return `${args.invitedByName} invited you to ${args.leagueName} as ${args.roleLabel} on ArcLight.

Accept here: ${args.claimUrl}

— ArcLight`;
}
