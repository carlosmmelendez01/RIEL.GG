/**
 * Sent to a coach when a league admin approves their team's roster for a
 * competition (registrationStatus → APPROVED).
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

export function RosterApproved({
  coachName,
  teamName,
  competitionName,
  game,
  teamUrl,
}: {
  coachName: string;
  teamName: string;
  competitionName: string;
  game: string;
  teamUrl: string;
}) {
  const preview = `${teamName} is approved for ${competitionName}.`;
  return (
    <EmailLayout preview={preview}>
      <H1>{teamName} is in.</H1>
      <Body14>
        Hi {coachName}, your roster for <strong>{competitionName}</strong> has been approved.
        Your team will be included in scheduling and standings updates from here on out.
      </Body14>
      <PrimaryButton href={teamUrl}>Open team page</PrimaryButton>
      <DetailBlock>
        <DetailRow label="Team" value={teamName} />
        <DetailRow label="Competition" value={competitionName} />
        <DetailRow label="Game" value={game} />
      </DetailBlock>
      <Muted12>
        If your league uses a manual scheduler, you&apos;ll see matchups appear once they
        run the round-robin generator.
      </Muted12>
    </EmailLayout>
  );
}

export function rosterApprovedText(args: {
  teamName: string;
  competitionName: string;
  teamUrl: string;
}): string {
  return `${args.teamName} is approved for ${args.competitionName}.

Open team: ${args.teamUrl}

— RIEL.GG`;
}
