"use client";

/**
 * League-admin match override panel.
 *
 * Renders four override actions as buttons that open a single modal whose
 * contents change based on which action was clicked:
 *   • Force final score — write a score regardless of consensus
 *   • Mark disputed     — escalate the match
 *   • Override status   — bump the match to any status
 *   • Revert forfeit    — undo a forfeit submission
 *
 * Every action requires a reason (>= 5 chars) that gets recorded in the
 * AuditLog by the matching server action. The modal closes on success and
 * the page revalidates via the action itself.
 */

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Hammer,
  ShieldAlert,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  forceMatchScore,
  markMatchDisputed,
  overrideMatchStatus,
  revertMatchForfeit,
} from "@/lib/match/admin-actions";
import { cn } from "@/lib/utils";

// --- Types --------------------------------------------------------------

type Action = "force" | "dispute" | "status" | "revert";

type MatchInfo = {
  id: string;
  status: string;
  isForfeit: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamLabel: string;
  awayTeamLabel: string;
};

const STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Scheduled", help: "Match has not started" },
  { value: "CHECKING_IN", label: "Checking in", help: "Teams confirming attendance" },
  { value: "IN_PROGRESS", label: "In progress", help: "Live, currently playing" },
  { value: "AWAITING_CONFIRMATION", label: "Awaiting confirmation", help: "Score reported, awaiting opponent" },
  { value: "FINISHED", label: "Finished", help: "Use 'Force final score' instead — this doesn't set a score" },
  { value: "FORFEITED", label: "Forfeited", help: "Marks as forfeit without scoring" },
  { value: "CANCELED", label: "Canceled", help: "Match removed from play" },
  { value: "DISPUTED", label: "Disputed", help: "Escalated for admin review" },
] as const;

// --- Top-level component -----------------------------------------------

export function AdminMatchOverrides({ match }: { match: MatchInfo }) {
  const [open, setOpen] = useState<Action | null>(null);

  return (
    <Card className="border-[color:var(--brand-gold)]/30 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[color:var(--brand-gold)]">
          Admin overrides
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hammer className="h-4 w-4 text-[color:var(--brand-gold)]" />
          Override actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          Use these only when the consensus flow can&apos;t reach a resolution. Every override
          writes an entry to the audit trail with the reason you provide.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <OverrideButton
            icon={ShieldAlert}
            label="Force final score"
            onClick={() => setOpen("force")}
          />
          <OverrideButton
            icon={CircleAlert}
            label="Mark disputed"
            disabled={match.status === "DISPUTED" || match.status === "CANCELED"}
            disabledReason={
              match.status === "DISPUTED"
                ? "Already disputed"
                : match.status === "CANCELED"
                  ? "Match canceled"
                  : undefined
            }
            onClick={() => setOpen("dispute")}
          />
          <OverrideButton
            icon={Sparkles}
            label="Override status"
            onClick={() => setOpen("status")}
          />
          <OverrideButton
            icon={Trophy}
            label="Revert forfeit"
            disabled={!match.isForfeit}
            disabledReason={!match.isForfeit ? "No forfeit to revert" : undefined}
            onClick={() => setOpen("revert")}
          />
        </div>
      </CardContent>

      {open ? (
        <OverrideModal action={open} match={match} onClose={() => setOpen(null)} />
      ) : null}
    </Card>
  );
}

function OverrideButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  disabledReason,
}: {
  icon: typeof Hammer;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-left text-[12px] font-medium transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}

// --- Modal --------------------------------------------------------------

function OverrideModal({
  action,
  match,
  onClose,
}: {
  action: Action;
  match: MatchInfo;
  onClose: () => void;
}) {
  const title = {
    force: "Force final score",
    dispute: "Mark match as disputed",
    status: "Override match status",
    revert: "Revert forfeit",
  }[action];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-override-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-gold)]">
              Admin override
            </p>
            <h2 id="admin-override-title" className="mt-0.5 text-lg font-semibold tracking-tight">
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

        <div className="px-5 py-4">
          {action === "force" ? (
            <ForceScoreForm match={match} onClose={onClose} />
          ) : action === "dispute" ? (
            <DisputeForm match={match} onClose={onClose} />
          ) : action === "status" ? (
            <OverrideStatusForm match={match} onClose={onClose} />
          ) : (
            <RevertForfeitForm match={match} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Force final score --------------------------------------------------

function ForceScoreForm({ match, onClose }: { match: MatchInfo; onClose: () => void }) {
  const [homeScore, setHomeScore] = useState(
    match.homeScore !== null ? String(match.homeScore) : "",
  );
  const [awayScore, setAwayScore] = useState(
    match.awayScore !== null ? String(match.awayScore) : "",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (Number.isNaN(h) || Number.isNaN(a)) {
      setError("Both scores must be whole numbers.");
      return;
    }
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r = await forceMatchScore({
        matchId: match.id,
        homeScore: h,
        awayScore: a,
        reason: reason.trim(),
      });
      if (r.ok) {
        setDone(true);
        setTimeout(onClose, 900);
      } else {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  if (done) return <SuccessNote message="Score recorded. Match marked finished." />;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Writes a final score regardless of report consensus. Use when coaches can&apos;t agree
        and you&apos;ve reviewed evidence directly.
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 rounded-lg border border-border/60 bg-background/40 p-4">
        <div className="text-center">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Home
          </p>
          <p className="mb-2 truncate text-[12px] font-semibold leading-tight">
            {match.homeTeamLabel}
          </p>
          <input
            type="number"
            min={0}
            max={99}
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            placeholder="0"
            className={cn(
              "w-full rounded-md border bg-card px-2 py-1 text-center text-2xl font-bold tabular-nums focus:outline-none",
              fieldErrors.homeScore
                ? "border-[color:var(--brand-crimson)]"
                : "border-border focus:border-[color:var(--brand-crimson)]",
            )}
          />
        </div>
        <span className="pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          vs
        </span>
        <div className="text-center">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Away
          </p>
          <p className="mb-2 truncate text-[12px] font-semibold leading-tight">
            {match.awayTeamLabel}
          </p>
          <input
            type="number"
            min={0}
            max={99}
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            placeholder="0"
            className={cn(
              "w-full rounded-md border bg-card px-2 py-1 text-center text-2xl font-bold tabular-nums focus:outline-none",
              fieldErrors.awayScore
                ? "border-[color:var(--brand-crimson)]"
                : "border-border focus:border-[color:var(--brand-crimson)]",
            )}
          />
        </div>
      </div>
      {fieldErrors.awayScore ? (
        <p className="text-[11px] text-[color:var(--brand-crimson)]">{fieldErrors.awayScore}</p>
      ) : null}

      <ReasonField value={reason} onChange={setReason} error={fieldErrors.reason} />

      <ErrorBanner error={error} />

      <ModalActions
        onClose={onClose}
        pending={pending}
        canSubmit={reason.trim().length >= 5}
        submitLabel="Save final score"
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// --- Mark disputed ------------------------------------------------------

function DisputeForm({ match, onClose }: { match: MatchInfo; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r = await markMatchDisputed({ matchId: match.id, reason: reason.trim() });
      if (r.ok) {
        setDone(true);
        setTimeout(onClose, 900);
      } else {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  if (done) return <SuccessNote message="Match marked disputed." />;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Flags the match for review. Coaches can&apos;t report further until you resolve it
        with <span className="font-semibold">Force final score</span> or{" "}
        <span className="font-semibold">Override status</span>.
      </p>
      <ReasonField value={reason} onChange={setReason} error={fieldErrors.reason} />
      <ErrorBanner error={error} />
      <ModalActions
        onClose={onClose}
        pending={pending}
        canSubmit={reason.trim().length >= 5}
        submitLabel="Mark disputed"
        onSubmit={handleSubmit}
        destructive
      />
    </div>
  );
}

// --- Override status ----------------------------------------------------

function OverrideStatusForm({ match, onClose }: { match: MatchInfo; onClose: () => void }) {
  const [newStatus, setNewStatus] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const isValidStatus = STATUS_OPTIONS.some((o) => o.value === newStatus);

  function handleSubmit() {
    if (!isValidStatus) {
      setError("Pick a status to move the match to.");
      return;
    }
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r = await overrideMatchStatus({
        matchId: match.id,
        // safe: we just validated against the closed list
        newStatus: newStatus as (typeof STATUS_OPTIONS)[number]["value"],
        reason: reason.trim(),
      });
      if (r.ok) {
        setDone(true);
        setTimeout(onClose, 900);
      } else {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  if (done) return <SuccessNote message="Status updated." />;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Current status:{" "}
        <span className="font-semibold capitalize text-foreground">
          {match.status.toLowerCase().replace(/_/g, " ")}
        </span>
        . Pick a new one. To set a final score, use{" "}
        <span className="font-semibold">Force final score</span> instead.
      </p>

      <div className="space-y-1">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          New status
        </label>
        <div className="grid gap-1">
          {STATUS_OPTIONS.filter((o) => o.value !== match.status).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background/40 p-2.5 transition-colors hover:border-border",
                newStatus === opt.value && "border-[color:var(--brand-gold)] bg-[color:var(--brand-gold)]/5",
              )}
            >
              <input
                type="radio"
                name="newStatus"
                value={opt.value}
                checked={newStatus === opt.value}
                onChange={() => setNewStatus(opt.value)}
                className="mt-0.5 accent-[color:var(--brand-gold)]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground">{opt.help}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <ReasonField value={reason} onChange={setReason} error={fieldErrors.reason} />
      <ErrorBanner error={error} />
      <ModalActions
        onClose={onClose}
        pending={pending}
        canSubmit={isValidStatus && reason.trim().length >= 5}
        submitLabel="Override status"
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// --- Revert forfeit -----------------------------------------------------

function RevertForfeitForm({ match, onClose }: { match: MatchInfo; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r = await revertMatchForfeit({ matchId: match.id, reason: reason.trim() });
      if (r.ok) {
        setDone(true);
        setTimeout(onClose, 900);
      } else {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  if (done) return <SuccessNote message="Forfeit reverted." />;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-gold)]" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Clears the forfeit flag and resets the match. If games were played before the
          forfeit, the prior scores stay and the match returns to <span className="font-semibold">Finished</span>;
          otherwise it goes back to <span className="font-semibold">Scheduled</span> so it can be replayed.
        </p>
      </div>
      <ReasonField value={reason} onChange={setReason} error={fieldErrors.reason} />
      <ErrorBanner error={error} />
      <ModalActions
        onClose={onClose}
        pending={pending}
        canSubmit={reason.trim().length >= 5}
        submitLabel="Revert forfeit"
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// --- Shared form bits ---------------------------------------------------

function ReasonField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Reason <span className="text-[color:var(--brand-crimson)]">*</span>{" "}
        <span className="font-normal normal-case text-muted-foreground/70">
          (recorded in the audit log)
        </span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Coaches couldn't agree on game 3 result — VOD review confirms Carmel 2-1."
        className={cn(
          "w-full resize-none rounded-md border bg-background p-2.5 text-[13px] focus:outline-none focus:ring-0",
          error ? "border-[color:var(--brand-crimson)]" : "border-border/60 focus:border-[color:var(--brand-crimson)]/40",
        )}
      />
      {error ? (
        <p className="mt-1 text-[11px] text-[color:var(--brand-crimson)]">{error}</p>
      ) : (
        <p className="mt-1 text-[10px] text-muted-foreground">5+ characters required.</p>
      )}
    </div>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[12px] text-[color:var(--brand-crimson)]">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{error}</p>
    </div>
  );
}

function ModalActions({
  onClose,
  pending,
  canSubmit,
  submitLabel,
  onSubmit,
  destructive,
}: {
  onClose: () => void;
  pending: boolean;
  canSubmit: boolean;
  submitLabel: string;
  onSubmit: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
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
        onClick={onSubmit}
        disabled={pending || !canSubmit}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          destructive
            ? "bg-[color:var(--brand-crimson)] hover:bg-[color:var(--brand-crimson-deep)]"
            : "bg-[color:var(--brand-gold)] text-black hover:bg-[color:var(--brand-gold)]/90",
        )}
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

function SuccessNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12px]">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
      <p>{message}</p>
    </div>
  );
}
