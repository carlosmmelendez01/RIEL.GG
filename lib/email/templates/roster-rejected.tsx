/**
 * Sent to a coach when a league admin rejects their team's roster, with the
 * reason they gave at rejection time.
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

export function RosterRejected({
  coachName,
  teamName,
  competitionName,
  reason,
  teamUrl,
}: {
  coachName: string;
  teamName: string;
  competitionName: string;
  reason: string;
  teamUrl: string;
}) {
  const preview = `${teamName} needs changes before joining ${competitionName}.`;
  return (
    <EmailLayout preview={preview}>
      <H1>{teamName} needs changes.</H1>
      <Body14>
        Hi {coachName}, your league admin couldn&apos;t approve your roster for{" "}
        <strong>{competitionName}</strong> as submitted. Here&apos;s what they wrote:
      </Body14>
      <DetailBlock>
        <DetailRow label="Reason" value={<em>{reason}</em>} />
      </DetailBlock>
      <Body14>
        Make the changes on your team page and re-submit. Reach out to your league office
        if anything in the feedback is unclear.
      </Body14>
      <PrimaryButton href={teamUrl}>Fix and resubmit</PrimaryButton>
      <Muted12>
        Roster rejections aren&apos;t permanent — most teams clear them in one revision.
      </Muted12>
    </EmailLayout>
  );
}

export function rosterRejectedText(args: {
  teamName: string;
  competitionName: string;
  reason: string;
  teamUrl: string;
}): string {
  return `${args.teamName} couldn't be approved for ${args.competitionName}.

Reason: ${args.reason}

Fix and resubmit: ${args.teamUrl}

— RIEL.GG`;
}
