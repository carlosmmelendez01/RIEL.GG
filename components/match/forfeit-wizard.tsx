"use client";

/**
 * 3-step forfeit submission wizard.
 *
 * Step 1 — Reschedule confirmation (Yes/No required, optional notes)
 * Step 2 — Reason for forfeit (enum, OTHER requires explanation)
 * Step 3 — Final confirmation with summary + warning
 *
 * Submission goes through `submitForfeit` server action which validates
 * server-side, writes the audit log, and revalidates downstream pages.
 *
 * Designed to be opened from any match detail page — the host passes
 * `matchId`, `side` (which roster is forfeiting), and labels for both
 * teams. Hosting a full match-context fetch inside the wizard would
 * couple it to the page; this way the wizard is reusable for admin
 * override flows that may render different surrounding UI.
 */

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  MessageSquare,
  ShieldAlert,
  X,
} from "lucide-react";

import {
  FORFEIT_REASONS,
  submitForfeit,
  type ForfeitReasonValue,
  type SubmitForfeitResult,
} from "@/lib/match/submit-forfeit-action";
import { cn } from "@/lib/utils";

// --- Reason labels (UI-only) -------------------------------------------

const REASON_LABEL: Record<ForfeitReasonValue, { label: string; helper: string }> = {
  OPPONENT_NO_SHOW: { label: "Opponent No-Show", helper: "The other team didn't show up." },
  SCHEDULING_CONFLICT: { label: "Scheduling Conflict", helper: "Couldn't find a time that worked for both." },
  INSUFFICIENT_ROSTER: { label: "Insufficient Roster", helper: "Couldn't field a complete lineup." },
  TECHNICAL_ISSUES: { label: "Technical Issues", helper: "Game client, network, or platform problems." },
  PLAYER_ILLNESS: { label: "Player Illness / Emergency", helper: "Illness or family emergency for a key player." },
  ELIGIBILITY_ISSUE: { label: "Eligibility Issue", helper: "Academic or transfer eligibility flagged." },
  WEATHER_TRAVEL: { label: "Weather / Travel Issues", helper: "School closure, snow day, or travel fell through." },
  OPPONENT_CONDUCT: { label: "Opponent Conduct / Cheating", helper: "Behavior or integrity concern." },
  OTHER: { label: "Other", helper: "Something else (please describe)." },
};

// --- Component ----------------------------------------------------------

export function ForfeitWizard({
  matchId,
  side,
  ownTeamLabel,
  opponentTeamLabel,
  opponentCoachEmail,
  open,
  onClose,
}: {
  matchId: string;
  side: "HOME" | "AWAY";
  ownTeamLabel: string;
  opponentTeamLabel: string;
  opponentCoachEmail?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <WizardDialog
      matchId={matchId}
      side={side}
      ownTeamLabel={ownTeamLabel}
      opponentTeamLabel={opponentTeamLabel}
      opponentCoachEmail={opponentCoachEmail}
      onClose={onClose}
    />
  );
}

function WizardDialog({
  matchId,
  side,
  ownTeamLabel,
  opponentTeamLabel,
  opponentCoachEmail,
  onClose,
}: Omit<Parameters<typeof ForfeitWizard>[0], "open">) {
  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [pending, startTransition] = useTransition();

  // Form state — server is source of truth, client just collects
  const [rescheduleAttempted, setRescheduleAttempted] = useState<boolean | null>(null);
  const [rescheduleNotes, setRescheduleNotes] = useState("");
  const [reason, setReason] = useState<ForfeitReasonValue | null>(null);
  const [forfeitNotes, setForfeitNotes] = useState("");

  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Extract<SubmitForfeitResult, { ok: true }> | null>(null);

  const canProceedStep1 = rescheduleAttempted !== null;
  const canProceedStep2 =
    reason !== null && (reason !== "OTHER" || forfeitNotes.trim().length > 0);

  function handleSubmit() {
    if (rescheduleAttempted === null || reason === null) return;
    setServerError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r = await submitForfeit({
        matchId,
        side,
        rescheduleAttempted,
        rescheduleNotes: rescheduleNotes.trim() || undefined,
        reason,
        forfeitNotes: forfeitNotes.trim() || undefined,
      });
      if (r.ok) {
        setResult(r);
        setStep("done");
      } else {
        setServerError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        // Jump back to the step that owns the errored field
        if (r.fieldErrors?.rescheduleAttempted) setStep(1);
        else if (r.fieldErrors?.reason || r.fieldErrors?.forfeitNotes) setStep(2);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forfeit-wizard-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== "done") onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              {step === "done" ? "Forfeit submitted" : "Submit a forfeit"}
            </p>
            <h2 id="forfeit-wizard-title" className="mt-0.5 text-lg font-semibold tracking-tight">
              {ownTeamLabel} vs {opponentTeamLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md p-1 text-muted-foreground hover:bg-card/60 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Step indicator (hidden on done) */}
        {step !== "done" ? (
          <div className="flex items-center gap-1 border-b border-border/60 px-5 py-3">
            {([1, 2, 3] as const).map((n, idx) => (
              <div key={n} className="flex flex-1 items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
                    step >= n
                      ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)] text-white"
                      : "border-border/60 bg-background text-muted-foreground",
                  )}
                >
                  {step > n ? <Check className="h-3 w-3" /> : n}
                </span>
                {idx < 2 ? (
                  <div
                    className={cn(
                      "mx-2 h-px flex-1 transition-colors",
                      step > n ? "bg-[color:var(--brand-crimson)]" : "bg-border/60",
                    )}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Body */}
        <div className="px-5 py-5">
          {step === 1 ? (
            <Step1Reschedule
              value={rescheduleAttempted}
              onChange={setRescheduleAttempted}
              notes={rescheduleNotes}
              onNotesChange={setRescheduleNotes}
              opponentCoachEmail={opponentCoachEmail}
              fieldError={fieldErrors.rescheduleAttempted}
            />
          ) : null}
          {step === 2 ? (
            <Step2Reason
              value={reason}
              onChange={setReason}
              notes={forfeitNotes}
              onNotesChange={setForfeitNotes}
              fieldError={fieldErrors.reason}
              notesError={fieldErrors.forfeitNotes}
            />
          ) : null}
          {step === 3 ? (
            <Step3Confirm
              ownTeamLabel={ownTeamLabel}
              opponentTeamLabel={opponentTeamLabel}
              rescheduleAttempted={rescheduleAttempted!}
              rescheduleNotes={rescheduleNotes}
              reason={reason!}
              forfeitNotes={forfeitNotes}
              serverError={serverError}
            />
          ) : null}
          {step === "done" && result ? (
            <DoneState result={result} ownTeamLabel={ownTeamLabel} />
          ) : null}
        </div>

        {/* Footer */}
        {step !== "done" ? (
          <footer className="flex items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
            <button
              type="button"
              onClick={() => {
                if (step === 1) onClose();
                else setStep((step - 1) as 1 | 2);
              }}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-medium hover:bg-card disabled:opacity-50"
            >
              {step === 1 ? (
                "Cancel"
              ) : (
                <>
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </>
              )}
            </button>

            {step === 3 ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-50"
              >
                <Flag className="h-3.5 w-3.5" />
                {pending ? "Submitting…" : "Submit forfeit"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
                className="inline-flex items-center gap-1 rounded-md bg-[color:var(--brand-crimson)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

// --- Step 1 ------------------------------------------------------------

function Step1Reschedule({
  value,
  onChange,
  notes,
  onNotesChange,
  opponentCoachEmail,
  fieldError,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  notes: string;
  onNotesChange: (s: string) => void;
  opponentCoachEmail?: string | null;
  fieldError?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold tracking-tight">
          Did you attempt to reschedule this match?
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Required. Most forfeits could be avoided with a quick check-in with the opposing coach.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BigChoice
          active={value === true}
          tone="emerald"
          onClick={() => onChange(true)}
          label="Yes"
          helper="I tried to reschedule first."
        />
        <BigChoice
          active={value === false}
          tone="crimson"
          onClick={() => onChange(false)}
          label="No"
          helper="I didn't try to reschedule."
        />
      </div>

      {value === true ? (
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder="What did you try? When did you reach out?"
            className="w-full resize-none rounded-md border border-border/60 bg-background p-2.5 text-[13px] focus:border-[color:var(--brand-crimson)]/40 focus:outline-none focus:ring-0"
          />
        </div>
      ) : null}

      <a
        href={opponentCoachEmail ? `mailto:${opponentCoachEmail}` : "#"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-[12px] font-medium transition-colors hover:bg-card",
          !opponentCoachEmail && "cursor-not-allowed opacity-60",
        )}
        aria-disabled={!opponentCoachEmail}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Message opponent now
      </a>

      {fieldError ? <p className="text-[12px] text-[color:var(--brand-crimson)]">{fieldError}</p> : null}
    </div>
  );
}

function BigChoice({
  active,
  tone,
  label,
  helper,
  onClick,
}: {
  active: boolean;
  tone: "emerald" | "crimson";
  label: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors",
        active
          ? tone === "emerald"
            ? "border-emerald-500/60 bg-emerald-500/10"
            : "border-[color:var(--brand-crimson)]/60 bg-[color:var(--brand-crimson)]/10"
          : "border-border/60 bg-card/60 hover:bg-card",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-[15px] font-semibold">{label}</span>
        {active ? <Check className="h-4 w-4" /> : null}
      </div>
      <span className="text-[11px] text-muted-foreground">{helper}</span>
    </button>
  );
}

// --- Step 2 ------------------------------------------------------------

function Step2Reason({
  value,
  onChange,
  notes,
  onNotesChange,
  fieldError,
  notesError,
}: {
  value: ForfeitReasonValue | null;
  onChange: (v: ForfeitReasonValue) => void;
  notes: string;
  onNotesChange: (s: string) => void;
  fieldError?: string;
  notesError?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[16px] font-semibold tracking-tight">Why are you forfeiting?</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Pick the closest match. The board uses this to spot trends — accurate answers reduce
          forfeits across the league.
        </p>
      </div>

      <div className="space-y-1.5">
        {FORFEIT_REASONS.map((r) => {
          const meta = REASON_LABEL[r];
          const isSel = value === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onChange(r)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSel
                  ? "border-[color:var(--brand-crimson)]/60 bg-[color:var(--brand-crimson)]/10"
                  : "border-border/60 bg-card/60 hover:bg-card",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  isSel
                    ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]"
                    : "border-border",
                )}
              >
                {isSel ? <Check className="h-2.5 w-2.5 text-white" /> : null}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">{meta.label}</p>
                <p className="text-[11px] text-muted-foreground">{meta.helper}</p>
              </div>
            </button>
          );
        })}
      </div>

      {value === "OTHER" ? (
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold">
            Please explain{" "}
            <span className="text-[color:var(--brand-crimson)]">*</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder="Required for 'Other' — what specifically happened?"
            className={cn(
              "w-full resize-none rounded-md border bg-background p-2.5 text-[13px] focus:outline-none focus:ring-0",
              notesError
                ? "border-[color:var(--brand-crimson)]/60 focus:border-[color:var(--brand-crimson)]"
                : "border-border/60 focus:border-[color:var(--brand-crimson)]/40",
            )}
          />
          {notesError ? (
            <p className="mt-1 text-[12px] text-[color:var(--brand-crimson)]">{notesError}</p>
          ) : null}
        </div>
      ) : null}

      {fieldError ? <p className="text-[12px] text-[color:var(--brand-crimson)]">{fieldError}</p> : null}
    </div>
  );
}

// --- Step 3 ------------------------------------------------------------

function Step3Confirm({
  ownTeamLabel,
  opponentTeamLabel,
  rescheduleAttempted,
  rescheduleNotes,
  reason,
  forfeitNotes,
  serverError,
}: {
  ownTeamLabel: string;
  opponentTeamLabel: string;
  rescheduleAttempted: boolean;
  rescheduleNotes: string;
  reason: ForfeitReasonValue;
  forfeitNotes: string;
  serverError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-crimson)]" />
        <div className="text-[13px] leading-relaxed">
          <p className="font-semibold text-foreground">This counts as a loss for {ownTeamLabel}.</p>
          <p className="mt-1 text-muted-foreground">
            The opposing team is awarded the win. Forfeits affect your standing and are recorded
            for league analytics. This action can&apos;t be undone without an admin override.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/40 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Summary
        </p>
        <dl className="space-y-2.5 text-[13px]">
          <SummaryRow label="Match" value={`${ownTeamLabel} vs ${opponentTeamLabel}`} />
          <SummaryRow
            label="Tried to reschedule"
            value={rescheduleAttempted ? "Yes" : "No"}
            valueClass={rescheduleAttempted ? "text-emerald-500" : "text-[color:var(--brand-crimson)]"}
          />
          {rescheduleAttempted && rescheduleNotes.trim() ? (
            <SummaryRow label="Reschedule notes" value={rescheduleNotes.trim()} />
          ) : null}
          <SummaryRow label="Reason" value={REASON_LABEL[reason].label} />
          {forfeitNotes.trim() ? (
            <SummaryRow label="Notes" value={forfeitNotes.trim()} />
          ) : null}
        </dl>
      </div>

      {serverError ? (
        <div className="flex items-start gap-2 rounded-lg border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[12px] text-[color:var(--brand-crimson)]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{serverError}</span>
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("font-medium", valueClass)}>{value}</dd>
    </div>
  );
}

// --- Done state --------------------------------------------------------

function DoneState({
  result,
  ownTeamLabel,
}: {
  result: Extract<SubmitForfeitResult, { ok: true }>;
  ownTeamLabel: string;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold tracking-tight">Forfeit submitted</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {result.status === "FORFEITED"
            ? `The match was recorded as a whole-match forfeit by ${ownTeamLabel}.`
            : `The match was recorded as a mid-match forfeit by ${ownTeamLabel}.`}
          <br />
          The opposing coach and the league office have been notified.
        </p>
      </div>
      <a
        href={`/dashboard/matches/${result.matchId}`}
        className="block w-full rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-center text-[12px] font-semibold text-white"
      >
        Back to match
        <ArrowRight className="ml-1 inline h-3 w-3" />
      </a>
    </div>
  );
}
