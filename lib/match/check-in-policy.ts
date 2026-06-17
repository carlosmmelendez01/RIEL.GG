export const MATCH_CHECK_IN_GRACE_MINUTES = 15;

export type CheckInReviewSide = "HOME" | "AWAY";

export type CheckInReviewReason =
  | "TOO_EARLY"
  | "CLOSED"
  | "BOTH_PRESENT"
  | "HOME_MISSING"
  | "AWAY_MISSING"
  | "BOTH_MISSING";

export type CheckInReviewState = {
  needsReview: boolean;
  suggestedForfeitingSide: CheckInReviewSide | null;
  reason: CheckInReviewReason;
  graceMinutes: number;
};

const CLOSED_STATUSES = new Set(["FINISHED", "FORFEITED", "CANCELED", "DISPUTED"]);
const REVIEWABLE_STATUSES = new Set(["SCHEDULED", "CHECKING_IN", "IN_PROGRESS"]);

export function evaluateCheckInReview({
  scheduledAt,
  status,
  isForfeit,
  homeCheckInCount,
  awayCheckInCount,
  now = new Date(),
}: {
  scheduledAt: Date;
  status: string;
  isForfeit: boolean;
  homeCheckInCount: number;
  awayCheckInCount: number;
  now?: Date;
}): CheckInReviewState {
  const base = {
    graceMinutes: MATCH_CHECK_IN_GRACE_MINUTES,
  };

  if (isForfeit || CLOSED_STATUSES.has(status) || !REVIEWABLE_STATUSES.has(status)) {
    return {
      ...base,
      needsReview: false,
      suggestedForfeitingSide: null,
      reason: "CLOSED",
    };
  }

  const graceEndsAt = new Date(
    scheduledAt.getTime() + MATCH_CHECK_IN_GRACE_MINUTES * 60 * 1000,
  );
  if (now < graceEndsAt) {
    return {
      ...base,
      needsReview: false,
      suggestedForfeitingSide: null,
      reason: "TOO_EARLY",
    };
  }

  const homePresent = homeCheckInCount > 0;
  const awayPresent = awayCheckInCount > 0;

  if (homePresent && awayPresent) {
    return {
      ...base,
      needsReview: false,
      suggestedForfeitingSide: null,
      reason: "BOTH_PRESENT",
    };
  }

  if (!homePresent && !awayPresent) {
    return {
      ...base,
      needsReview: true,
      suggestedForfeitingSide: null,
      reason: "BOTH_MISSING",
    };
  }

  if (!homePresent) {
    return {
      ...base,
      needsReview: true,
      suggestedForfeitingSide: "HOME",
      reason: "HOME_MISSING",
    };
  }

  return {
    ...base,
    needsReview: true,
    suggestedForfeitingSide: "AWAY",
    reason: "AWAY_MISSING",
  };
}
