"use client";

/**
 * Coach-side match reporting panel.
 *
 * State machine driven by `match.status` + `match.lastReport.reportedSide`:
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │ status         | reporter side | viewer side  | UI                 │
 *   ├────────────────────────────────────────────────────────────────────┤
 *   │ SCHEDULED      |     —         | own          | Submit form        │
 *   │ CHECKING_IN    |     —         | own          | Submit form        │
 *   │ IN_PROGRESS    |     —         | own          | Submit form        │
 *   │ AWAITING_CONF. | viewer's      | own          | "Waiting on opp"   │
 *   │ AWAITING_CONF. | opponent's    | own          | Confirm/Dispute    │
 *   │ FINISHED       | —             | own          | Final result       │
 *   │ DISPUTED       | —             | own          | Awaiting admin     │
 *   │ FORFEITED      | —             | own          | Forfeit (handled   │
 *   │                |               |              |  elsewhere)        │
 *   └────────────────────────────────────────────────────────────────────┘
 */

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock,
  Flag,
  Hourglass,
  ScrollText,
  Send,
  ThumbsDown,
  Trophy,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  confirmMatchReport,
  disputeMatchReport,
  submitMatchReport,
  type ConfirmReportResult,
  type DisputeReportResult,
  type SubmitReportResult,
} from "@/lib/match/report-actions";
import type { CoachMatchDetail } from "@/lib/coach/dashboard";
import { cn } from "@/lib/utils";

// --- Props -------------------------------------------------------------

export function MatchReportingPanel({ match }: { match: CoachMatchDetail }) {
  const { status, side, lastReport, canReport, isForfeit } = match;

  // Forfeited matches use the dedicated ForfeitTrigger surface
  if (isForfeit) return null;

  if (status === "FINISHED") {
    return (
      <FinalResultCard match={match} />
    );
  }

  if (status === "CANCELED") {
    return (
      <StatusCard
        icon={CircleAlert}
        tone="muted"
        title="Match canceled"
        body="A league admin canceled this match. Contact your league office for re-scheduling options."
      />
    );
  }

  if (status === "DISPUTED") {
    return (
      <StatusCard
        icon={AlertTriangle}
        tone="crimson"
        title="Awaiting admin resolution"
        body="A coach disputed the submitted score. A league admin will review and post a final result. You'll be notified when it resolves."
      />
    );
  }

  if (status === "AWAITING_CONFIRMATION" && lastReport) {
    // Viewer is on the same side as the reporter — wait for opponent
    if (lastReport.reportedSide === side) {
      return (
        <StatusCard
          icon={Hourglass}
          tone="gold"
          title="Waiting on the opposing coach"
          body={`You submitted ${lastReport.homeScore}–${lastReport.awayScore}. The opposing coach has to confirm or dispute. Most coaches respond within 24 hours.`}
          footnote={
            lastReport.notes ? `Your note: ${lastReport.notes}` : undefined
          }
        />
      );
    }
    // Viewer is on the OTHER side — confirm or dispute
    return (
      <ConfirmDisputeCard match={match} report={lastReport} canAct={canReport} />
    );
  }

  // Reportable states (no live report yet)
  if (status === "SCHEDULED" || status === "CHECKING_IN" || status === "IN_PROGRESS") {
    if (!canReport) {
      return (
        <StatusCard
          icon={ScrollText}
          tone="muted"
          title="Score reporting is coach-only"
          body="Only the team's coach, captain, or manager can submit a final score after the match wraps up."
        />
      );
    }
    return <SubmitReportCard match={match} />;
  }

  return null;
}

// --- Final result ------------------------------------------------------

function FinalResultCard({ match }: { match: CoachMatchDetail }) {
  const ourScore = match.side === "HOME" ? match.homeScore : match.awayScore;
  const theirScore = match.side === "HOME" ? match.awayScore : match.homeScore;
  const weWon =
    ourScore !== null && theirScore !== null && ourScore > theirScore;
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Final result
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy
            className={cn(
              "h-4 w-4",
              weWon ? "text-emerald-500" : "text-[color:var(--brand-crimson)]",
            )}
          />
          {weWon ? "Win" : "Loss"} confirmed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[13px]">
          <span className="font-mono text-2xl font-bold tabular-nums">
            {ourScore}–{theirScore}
          </span>
          <span className="ml-3 text-muted-foreground">
            {match.finishedAt
              ? `Finalized ${match.finishedAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`
              : "Finalized"}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

// --- Submit report (initial) ------------------------------------------

function SubmitReportCard({ match }: { match: CoachMatchDetail }) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<SubmitReportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (Number.isNaN(h) || Number.isNaN(a)) {
      setResult({
        ok: false,
        error: "Enter whole-number scores for both sides.",
      });
      return;
    }
    startTransition(async () => {
      const r = await submitMatchReport({
        matchId: match.id,
        homeScore: h,
        awayScore: a,
        notes: notes.trim() || undefined,
      });
      setResult(r);
    });
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Reporting
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-[color:var(--brand-purple)]" />
          Submit final score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Post the final result. The opposing coach has to confirm or dispute before
          it counts. Best of {match.id ? "" : ""}series — enter map wins, not round scores.
        </p>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 rounded-lg border border-border/60 bg-background/40 p-4">
          <div className="text-center">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {match.side === "HOME" ? "You" : "Opponent"}
            </p>
            <p className="mb-2 truncate text-[12px] font-semibold leading-tight">
              {match.side === "HOME" ? match.ownTeam.name : match.opponentTeam.name}
            </p>
            <input
              type="number"
              min={0}
              max={99}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-border bg-card px-2 py-1 text-center text-2xl font-bold tabular-nums focus:border-[color:var(--brand-crimson)] focus:outline-none"
            />
          </div>
          <span className="pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            vs
          </span>
          <div className="text-center">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {match.side === "AWAY" ? "You" : "Opponent"}
            </p>
            <p className="mb-2 truncate text-[12px] font-semibold leading-tight">
              {match.side === "AWAY" ? match.ownTeam.name : match.opponentTeam.name}
            </p>
            <input
              type="number"
              min={0}
              max={99}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-border bg-card px-2 py-1 text-center text-2xl font-bold tabular-nums focus:border-[color:var(--brand-crimson)] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Notes{" "}
            <span className="font-normal normal-case text-muted-foreground/70">
              (optional, visible to opponent + admin)
            </span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the opposing coach should know — game-by-game scores, disputes during play, evidence links."
            className="w-full resize-none rounded-md border border-border/60 bg-background p-2.5 text-[12px] focus:border-[color:var(--brand-crimson)]/40 focus:outline-none focus:ring-0"
          />
        </div>

        {result && !result.ok ? (
          <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[12px] text-[color:var(--brand-crimson)]">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p>{result.error}</p>
              {result.fieldErrors ? (
                <ul className="mt-1 list-disc pl-4">
                  {Object.entries(result.fieldErrors).map(([f, msg]) => (
                    <li key={f}>
                      <span className="font-mono">{f}</span>: {msg}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        {result?.ok ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12px]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold">Submitted.</p>
              <p className="mt-0.5 text-muted-foreground">
                Waiting on the opposing coach to confirm or dispute. They&apos;ll see a
                notification next time they sign in.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || result?.ok}
            className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {pending ? "Submitting…" : result?.ok ? "Submitted" : "Submit score"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Confirm / dispute ------------------------------------------------

function ConfirmDisputeCard({
  match,
  report,
  canAct,
}: {
  match: CoachMatchDetail;
  report: NonNullable<CoachMatchDetail["lastReport"]>;
  canAct: boolean;
}) {
  const [mode, setMode] = useState<"choose" | "dispute" | "done">("choose");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmResult, setConfirmResult] = useState<ConfirmReportResult | null>(null);
  const [disputeResult, setDisputeResult] = useState<DisputeReportResult | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const r = await confirmMatchReport({ matchId: match.id });
      setConfirmResult(r);
      if (r.ok) setMode("done");
    });
  }

  function handleDispute() {
    if (reason.trim().length < 5) {
      setDisputeResult({ ok: false, error: "Tell the admin what's wrong (5+ chars)." });
      return;
    }
    startTransition(async () => {
      const r = await disputeMatchReport({ matchId: match.id, reason: reason.trim() });
      setDisputeResult(r);
      if (r.ok) setMode("done");
    });
  }

  // Score from the report — shown from the viewer's perspective
  const ourReportScore =
    match.side === "HOME" ? report.homeScore : report.awayScore;
  const theirReportScore =
    match.side === "HOME" ? report.awayScore : report.homeScore;

  return (
    <Card className="border-[color:var(--brand-gold)]/30 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[color:var(--brand-gold)]">
          Needs your call
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-[color:var(--brand-gold)]" />
          {report.reporterName} reported a final score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score display */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-center">
          <p className="font-mono text-3xl font-bold tabular-nums">
            <span className={ourReportScore > theirReportScore ? "text-emerald-500" : ""}>
              {ourReportScore}
            </span>
            <span className="px-2 text-muted-foreground/40">–</span>
            <span className={theirReportScore > ourReportScore ? "text-emerald-500" : ""}>
              {theirReportScore}
            </span>
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            You vs Opponent
          </p>
          {report.notes ? (
            <p className="mt-3 max-w-md whitespace-pre-line border-t border-border/60 pt-3 text-left text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">Opponent&apos;s note:</span>{" "}
              {report.notes}
            </p>
          ) : null}
          <p className="mt-2 text-[10px] text-muted-foreground/70">
            Submitted {timeAgo(report.submittedAt)}
          </p>
        </div>

        {!canAct ? (
          <p className="text-[12px] text-muted-foreground">
            Only the team&apos;s coach, captain, or manager can confirm or dispute.
          </p>
        ) : mode === "choose" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-500 px-3 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {pending ? "Confirming…" : "Confirm this score"}
            </button>
            <button
              type="button"
              onClick={() => setMode("dispute")}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 px-3 py-2 text-[13px] font-semibold text-[color:var(--brand-crimson)] transition-colors hover:bg-[color:var(--brand-crimson)]/20 disabled:opacity-50"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Dispute
            </button>
          </div>
        ) : mode === "dispute" ? (
          <div className="space-y-3 rounded-lg border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-crimson)]">
                What&apos;s wrong? <span className="text-[color:var(--brand-crimson)]">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Final game score was actually 2-2 — we won game 3. Screenshot attached."
                className="w-full resize-none rounded-md border border-border bg-background p-2.5 text-[13px] focus:border-[color:var(--brand-crimson)] focus:outline-none focus:ring-0"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                A league admin reads this and resolves. The other coach sees the message too.
              </p>
            </div>

            {disputeResult && !disputeResult.ok ? (
              <p className="text-[12px] text-[color:var(--brand-crimson)]">
                {disputeResult.error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode("choose")}
                disabled={pending}
                className="rounded-md border border-border/60 px-3 py-1.5 text-[12px] font-medium hover:bg-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispute}
                disabled={pending || reason.trim().length < 5}
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Flag className="h-3 w-3" />
                {pending ? "Submitting…" : "Submit dispute"}
              </button>
            </div>
          </div>
        ) : mode === "done" ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12px]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold">
                {confirmResult?.ok ? "Confirmed." : "Dispute submitted."}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {confirmResult?.ok
                  ? "Match is final. Standings will update on the next refresh."
                  : "A league admin will review and post a final resolution. You'll be notified."}
              </p>
            </div>
          </div>
        ) : null}

        {confirmResult && !confirmResult.ok ? (
          <p className="text-[12px] text-[color:var(--brand-crimson)]">{confirmResult.error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Generic status card ----------------------------------------------

function StatusCard({
  icon: Icon,
  tone,
  title,
  body,
  footnote,
}: {
  icon: typeof Clock;
  tone: "gold" | "crimson" | "muted";
  title: string;
  body: string;
  footnote?: string;
}) {
  return (
    <Card
      className={cn(
        "border-border/60 bg-card/80",
        tone === "gold" && "border-[color:var(--brand-gold)]/30",
        tone === "crimson" && "border-[color:var(--brand-crimson)]/30",
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <Icon
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            tone === "gold" && "text-[color:var(--brand-gold)]",
            tone === "crimson" && "text-[color:var(--brand-crimson)]",
            tone === "muted" && "text-muted-foreground",
          )}
        />
        <div>
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
          {footnote ? (
            <p className="mt-2 rounded border border-border/60 bg-background/40 p-2 font-mono text-[11px] text-muted-foreground">
              {footnote}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Helpers ----------------------------------------------------------

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
