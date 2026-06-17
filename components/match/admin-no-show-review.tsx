"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Flag,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markMatchDisputed } from "@/lib/match/admin-actions";
import { submitForfeit } from "@/lib/match/submit-forfeit-action";
import { cn } from "@/lib/utils";

type Side = "HOME" | "AWAY";

type CheckInReviewState = {
  needsReview: boolean;
  suggestedForfeitingSide: Side | null;
  reason: string;
  graceMinutes: number;
};

type AdminNoShowReviewMatch = {
  id: string;
  status: string;
  isForfeit: boolean;
  homeTeamLabel: string;
  awayTeamLabel: string;
  checkIn: {
    homeCheckedInCount: number;
    awayCheckedInCount: number;
    homeRosterSize: number;
    awayRosterSize: number;
    homeCheckedInNames: string[];
    awayCheckedInNames: string[];
    review: CheckInReviewState;
  };
};

type ModalState =
  | { type: "forfeit"; side: Side }
  | { type: "dispute" }
  | null;

export function AdminNoShowReview({ match }: { match: AdminNoShowReviewMatch }) {
  const [modal, setModal] = useState<ModalState>(null);
  const review = match.checkIn.review;
  const bothMissing = review.reason === "BOTH_MISSING";
  const canResolve = review.needsReview && !match.isForfeit;

  return (
    <Card
      className={cn(
        "border-border/60 bg-card/80",
        review.needsReview && "border-orange-500/40 bg-orange-500/5",
      )}
    >
      <CardHeader className="pb-3">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.13em]",
            review.needsReview ? "text-orange-500" : "text-muted-foreground",
          )}
        >
          No-show review
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          {review.needsReview ? (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          )}
          Check-in enforcement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <CheckInSideCard
            label="Home"
            team={match.homeTeamLabel}
            checkedInCount={match.checkIn.homeCheckedInCount}
            rosterSize={match.checkIn.homeRosterSize}
            checkedInNames={match.checkIn.homeCheckedInNames}
            flagged={review.suggestedForfeitingSide === "HOME" || bothMissing}
          />
          <CheckInSideCard
            label="Away"
            team={match.awayTeamLabel}
            checkedInCount={match.checkIn.awayCheckedInCount}
            rosterSize={match.checkIn.awayRosterSize}
            checkedInNames={match.checkIn.awayCheckedInNames}
            flagged={review.suggestedForfeitingSide === "AWAY" || bothMissing}
          />
        </div>

        <div
          className={cn(
            "rounded-md border p-3 text-[12px] leading-relaxed",
            review.needsReview
              ? "border-orange-500/30 bg-orange-500/10 text-muted-foreground"
              : "border-border/60 bg-background/40 text-muted-foreground",
          )}
        >
          {review.needsReview ? (
            <p>
              The {review.graceMinutes}-minute grace window has passed.{" "}
              {review.suggestedForfeitingSide ? (
                <>
                  <span className="font-semibold text-foreground">
                    {sideLabel(review.suggestedForfeitingSide, match)}
                  </span>{" "}
                  has no check-ins, so this match needs admin review before a no-show
                  forfeit is recorded.
                </>
              ) : (
                <>
                  Neither side has checked in. Review coach communication before choosing a
                  forfeit, dispute, cancellation, or reschedule.
                </>
              )}
            </p>
          ) : (
            <p>{reviewMessage(review.reason, review.graceMinutes)}</p>
          )}
        </div>

        {canResolve ? (
          <div className="flex flex-wrap items-center gap-2">
            {review.suggestedForfeitingSide ? (
              <ReviewButton
                icon={Flag}
                label={`Record ${shortSideLabel(review.suggestedForfeitingSide)} no-show`}
                onClick={() => setModal({ type: "forfeit", side: review.suggestedForfeitingSide! })}
              />
            ) : (
              <>
                <ReviewButton
                  icon={Flag}
                  label="Record home no-show"
                  onClick={() => setModal({ type: "forfeit", side: "HOME" })}
                />
                <ReviewButton
                  icon={Flag}
                  label="Record away no-show"
                  onClick={() => setModal({ type: "forfeit", side: "AWAY" })}
                />
              </>
            )}
            <ReviewButton
              icon={CircleAlert}
              label="Mark disputed"
              variant="secondary"
              onClick={() => setModal({ type: "dispute" })}
            />
          </div>
        ) : null}
      </CardContent>

      {modal ? (
        <NoShowModal match={match} modal={modal} onClose={() => setModal(null)} />
      ) : null}
    </Card>
  );
}

function CheckInSideCard({
  label,
  team,
  checkedInCount,
  rosterSize,
  checkedInNames,
  flagged,
}: {
  label: string;
  team: string;
  checkedInCount: number;
  rosterSize: number;
  checkedInNames: string[];
  flagged: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-background/40 p-3",
        flagged && checkedInCount === 0 && "border-orange-500/40 bg-orange-500/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold">{team}</p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-[12px] font-bold tabular-nums",
            checkedInCount > 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-orange-500/30 bg-orange-500/10 text-orange-500",
          )}
        >
          {checkedInCount}/{rosterSize}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {checkedInNames.length > 0
          ? formatNames(checkedInNames)
          : "No one checked in from this side."}
      </p>
    </div>
  );
}

function ReviewButton({
  icon: Icon,
  label,
  onClick,
  variant = "primary",
}: {
  icon: typeof Flag;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors",
        variant === "primary"
          ? "bg-orange-500 text-black hover:bg-orange-400"
          : "border border-border/60 bg-background/40 hover:bg-card",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function NoShowModal({
  match,
  modal,
  onClose,
}: {
  match: AdminNoShowReviewMatch;
  modal: Exclude<ModalState, null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const title =
    modal.type === "forfeit"
      ? `Record ${shortSideLabel(modal.side)} no-show`
      : "Mark match disputed";
  const targetTeam = modal.type === "forfeit" ? sideLabel(modal.side, match) : null;
  const defaultReason = useMemo(() => {
    if (modal.type === "forfeit") {
      return `${targetTeam} had no check-ins after the ${match.checkIn.review.graceMinutes}-minute match check-in grace period.`;
    }
    return `No-show check-in review for ${match.homeTeamLabel} vs ${match.awayTeamLabel}.`;
  }, [match, modal.type, targetTeam]);

  function handleSubmit() {
    const finalNote = note.trim() || defaultReason;
    setError(null);
    startTransition(async () => {
      const result =
        modal.type === "forfeit"
          ? await submitForfeit({
              matchId: match.id,
              side: modal.side,
              rescheduleAttempted: false,
              reason: "OPPONENT_NO_SHOW",
              forfeitNotes: finalNote,
            })
          : await markMatchDisputed({
              matchId: match.id,
              reason: finalNote,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDone(true);
      router.refresh();
      setTimeout(onClose, 900);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="no-show-review-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-500">
              No-show review
            </p>
            <h2 id="no-show-review-title" className="mt-0.5 text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {match.homeTeamLabel} vs {match.awayTeamLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/40 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {done ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12px]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <p>
                {modal.type === "forfeit"
                  ? "No-show forfeit recorded."
                  : "Match marked disputed."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {modal.type === "forfeit" ? (
                    <>
                      This gives the opposing side the match win and emails their coaches.
                      Confirm you reviewed check-ins and coach communication first.
                    </>
                  ) : (
                    <>
                      This pauses match reporting until an admin resolves the dispute with
                      a score, status change, or forfeit.
                    </>
                  )}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Admin note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder={defaultReason}
                  className="w-full resize-none rounded-md border border-border/60 bg-background p-2.5 text-[13px] focus:border-orange-500/60 focus:outline-none focus:ring-0"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Saved in the audit trail. Leaving this blank uses the default note.
                </p>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[12px] text-[color:var(--brand-crimson)]">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="rounded-md border border-border/60 px-3 py-2 text-[12px] font-medium hover:bg-background/40 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={pending}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    modal.type === "forfeit"
                      ? "bg-orange-500 text-black hover:bg-orange-400"
                      : "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
                  )}
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {modal.type === "forfeit" ? "Record no-show" : "Mark disputed"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function sideLabel(side: Side, match: AdminNoShowReviewMatch): string {
  return side === "HOME" ? match.homeTeamLabel : match.awayTeamLabel;
}

function shortSideLabel(side: Side): string {
  return side === "HOME" ? "home" : "away";
}

function formatNames(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more checked in`;
}

function reviewMessage(reason: string, graceMinutes: number): string {
  switch (reason) {
    case "TOO_EARLY":
      return `No-show review opens after the ${graceMinutes}-minute match check-in grace period.`;
    case "BOTH_PRESENT":
      return "Both sides have checked in. No no-show action is needed.";
    case "CLOSED":
      return "This match is closed or no longer eligible for no-show review.";
    default:
      return "No no-show issue detected.";
  }
}
