"use client";

/**
 * "Get help" affordance.
 *
 * Single source of truth for "the user is stuck." Used by:
 *  - The global error boundary (app/error.tsx)
 *  - The persistent help launcher (mounted in shared layouts)
 *  - Match-detail toolkit when a coach reports a match-blocking issue
 *
 * Submissions persist to the Feedback table via the `submitFeedback` server
 * action and (when configured) email the team — returning a real reference
 * id the user can quote.
 */

import { useId, useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, LifeBuoy, Send, X } from "lucide-react";

import { submitFeedback } from "@/lib/feedback/actions";
import { cn } from "@/lib/utils";

export type ReportContext = {
  route: string;
  errorDigest?: string | null;
};

export function ReportIssueButton({
  context,
  variant = "outline",
  label = "Get help",
}: {
  context: ReportContext;
  variant?: "outline" | "subtle" | "primary";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
          variant === "outline" &&
            "border border-border/60 bg-card/60 text-foreground hover:bg-card",
          variant === "subtle" &&
            "text-muted-foreground hover:bg-card/60 hover:text-foreground",
          variant === "primary" &&
            "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
        )}
      >
        <LifeBuoy className="h-3.5 w-3.5" />
        {label}
      </button>
      {open ? <ReportIssueDialog context={context} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// --- Dialog -------------------------------------------------------------

function ReportIssueDialog({
  context,
  onClose,
}: {
  context: ReportContext;
  onClose: () => void;
}) {
  const fieldId = useId();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (body.trim().length < 5) return;
    setError(null);
    startTransition(async () => {
      const res = await submitFeedback({
        message: body.trim(),
        route: context.route,
        errorDigest: context.errorDigest ?? undefined,
      });
      if (res.ok) setSubmittedRef(res.referenceId);
      else setError(res.error);
    });
  }

  const supportSubject = encodeURIComponent(
    `[RIEL.GG] Help — ${context.route}${context.errorDigest ? ` (${context.errorDigest})` : ""}`,
  );
  const supportBody = encodeURIComponent(
    `Hi RIEL team,\n\nI hit an issue on ${context.route}.\n${
      context.errorDigest ? `Reference: ${context.errorDigest}\n` : ""
    }\nWhat happened:\n`,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${fieldId}-title`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl border border-border/60 bg-card p-6 shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              We&apos;re here to help
            </p>
            <h2 id={`${fieldId}-title`} className="mt-1 text-lg font-semibold tracking-tight">
              {submittedRef ? "Got it — we're on it." : "What's broken?"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-card/60 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {submittedRef ? (
          <SuccessState referenceId={submittedRef} onClose={onClose} />
        ) : (
          <form onSubmit={handleSubmit} className="mt-4">
            <textarea
              id={fieldId}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Score isn't saving · can't get into chat · page won't load…"
              className="w-full resize-none rounded-md border border-border/60 bg-background p-3 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-[color:var(--brand-crimson)]/40 focus:outline-none focus:ring-0"
              autoFocus
            />

            <p className="mt-2 text-[11px] text-muted-foreground">
              We&apos;ll automatically include the page you&apos;re on
              {context.errorDigest ? `, the error reference (${context.errorDigest}),` : ""}{" "}
              and your account so you don&apos;t have to repeat yourself.
            </p>

            {error ? (
              <p className="mt-2 text-[12px] text-[color:var(--brand-crimson)]">{error}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <a
                href={`mailto:support@riel.gg?subject=${supportSubject}&body=${supportBody}`}
                className="text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Or email us instead
              </a>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border/60 px-3 py-1.5 text-[12px] font-medium hover:bg-card/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || body.trim().length < 5}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  {pending ? "Sending…" : "Send to RIEL"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessState({ referenceId, onClose }: { referenceId: string; onClose: () => void }) {
  return (
    <div className="mt-4">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <div className="text-[13px] leading-relaxed">
          <p className="font-semibold text-foreground">A real person will reach out.</p>
          <p className="mt-1 text-muted-foreground">
            We&apos;ll respond by email within one business day. If this is blocking a live match,
            text the league&apos;s admin number — your league dashboard has it pinned.
          </p>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Reference · {referenceId}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-md border border-border/60 bg-card/60 px-3 py-2 text-[13px] font-medium hover:bg-card"
      >
        Back to what I was doing
      </button>
    </div>
  );
}

