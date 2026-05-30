/**
 * Sent to the OPPOSING coach (not the one who submitted) when a forfeit is
 * recorded against an upcoming match. They need to know they got a default
 * win and can plan accordingly.
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

const REASON_LABEL: Record<string, string> = {
  OPPONENT_NO_SHOW: "Opponent no-show",
  SCHEDULING_CONFLICT: "Scheduling conflict",
  INSUFFICIENT_ROSTER: "Insufficient roster",
  TECHNICAL_ISSUES: "Technical issues",
  PLAYER_ILLNESS: "Player illness / emergency",
  ELIGIBILITY_ISSUE: "Eligibility issue",
  WEATHER_TRAVEL: "Weather / travel",
  OPPONENT_CONDUCT: "Opponent conduct",
  OTHER: "Other",
};

export function ForfeitSubmitted({
  opponentCoachName,
  forfeitingTeamName,
  receivingTeamName,
  competitionName,
  scheduledAt,
  reason,
  reasonNotes,
  matchUrl,
}: {
  opponentCoachName: string;
  forfeitingTeamName: string;
  receivingTeamName: string;
  competitionName: string;
  scheduledAt: Date;
  reason: string;
  reasonNotes: string | null;
  matchUrl: string;
}) {
  const preview = `${forfeitingTeamName} forfeited your match. ${receivingTeamName} takes the win.`;
  const when = scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const reasonLabel = REASON_LABEL[reason] ?? reason;

  return (
    <EmailLayout preview={preview}>
      <H1>You got a default win.</H1>
      <Body14>
        Hi {opponentCoachName}, <strong>{forfeitingTeamName}</strong> submitted a forfeit for
        your upcoming match. <strong>{receivingTeamName}</strong> is credited with the win and
        the result is final.
      </Body14>
      <DetailBlock>
        <DetailRow label="Match" value={`${forfeitingTeamName} vs ${receivingTeamName}`} />
        <DetailRow label="Competition" value={competitionName} />
        <DetailRow label="Scheduled" value={when} />
        <DetailRow label="Reason" value={reasonLabel} />
        {reasonNotes ? <DetailRow label="Notes" value={<em>{reasonNotes}</em>} /> : null}
      </DetailBlock>
      <PrimaryButton href={matchUrl}>View match</PrimaryButton>
      <Muted12>
        If you think this forfeit was filed in error, your league admin can revert it from
        the match detail page.
      </Muted12>
    </EmailLayout>
  );
}

export function forfeitSubmittedText(args: {
  forfeitingTeamName: string;
  receivingTeamName: string;
  competitionName: string;
  matchUrl: string;
}): string {
  return `${args.forfeitingTeamName} forfeited your match in ${args.competitionName}. ${args.receivingTeamName} takes the win.

View match: ${args.matchUrl}

— RIEL.GG`;
}
