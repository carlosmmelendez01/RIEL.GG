"use client";

/**
 * League-admin pending rosters queue.
 *
 * Shows every Roster awaiting approval across the league. Each row gets
 * Approve and Reject buttons (reject opens an inline reason field, 5+ chars
 * required). Approval enables the roster to show up in scheduler counts.
 */

import { useState, useTransition } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  ScrollText,
  ShieldCheck,
  ThumbsDown,
  Trophy,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveRoster,
  rejectRoster,
  type ApproveRosterResult,
  type RejectRosterResult,
} from "@/lib/team/roster-actions";
import type { PendingRosterRow } from "@/lib/league-admin/dashboard";
import { cn } from "@/lib/utils";

export function PendingRostersCard({
  rosters,
}: {
  rosters: PendingRosterRow[];
}) {
  return (
    <Card className="border-[color:var(--brand-gold)]/30 bg-card/60">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[color:var(--brand-gold)]">
          Roster approvals
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-[color:var(--brand-gold)]" />
          Pending roster registrations
          <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {rosters.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rosters.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <UserCheck className="mx-auto h-5 w-5 text-emerald-500" />
            <p className="mt-2 text-[13px] font-semibold">No rosters waiting.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              When a coach registers a team for one of your competitions, it lands here
              for review.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rosters.map((r) => (
              <li key={r.rosterId}>
                <RosterRow roster={r} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RosterRow({ roster }: { roster: PendingRosterRow }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"idle" | "rejecting" | "approved" | "rejected">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const r: ApproveRosterResult = await approveRoster({ rosterId: roster.rosterId });
      if (r.ok) setMode("approved");
      else setError(r.error);
    });
  }

  function handleReject() {
    if (reason.trim().length < 5) {
      setError("Add a reason (5+ chars).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r: RejectRosterResult = await rejectRoster({
        rosterId: roster.rosterId,
        reason: reason.trim(),
      });
      if (r.ok) setMode("rejected");
      else setError(r.error);
    });
  }

  if (mode === "approved" || mode === "rejected") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border p-3 text-[12px]",
          mode === "approved"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-border/60 bg-background/40",
        )}
      >
        {mode === "approved" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <X className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span>
          <span className="font-semibold">{roster.teamName}</span> — {mode}. Refreshing…
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold tracking-tight text-muted-foreground"
        >
          {(roster.schoolShort || roster.schoolName)
            .replace(/[^A-Za-z]/g, "")
            .slice(0, 3)
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{roster.teamName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {roster.schoolName} · {roster.competitionName} · {roster.game}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {roster.tier.toLowerCase()} · {roster.rosterSize} player
            {roster.rosterSize === 1 ? "" : "s"} · submitted {timeAgo(roster.submittedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-[12px]">
          <DetailRow icon={Trophy} label="Competition">
            {roster.competitionName}
          </DetailRow>
          <DetailRow icon={ScrollText} label="Game / tier">
            {roster.game} · {roster.tier.toLowerCase()}
          </DetailRow>
          <DetailRow icon={Building2} label="School">
            {roster.schoolName}
          </DetailRow>
          <DetailRow icon={Users} label="Roster size">
            {roster.rosterSize} player{roster.rosterSize === 1 ? "" : "s"}
          </DetailRow>
          <DetailRow icon={Clock} label="Submitted">
            {roster.submittedAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </DetailRow>
          {roster.rosterSize === 0 ? (
            <p className="mt-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-2 text-[11px] text-orange-600 dark:text-orange-400">
              ⚠️ This roster has zero players. Approving anyway is fine — coach can add
              players later if the registration policy allows.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-2 text-[11px] text-[color:var(--brand-crimson)]">
          <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {mode === "rejecting" ? (
        <div className="mt-3 space-y-2 rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-crimson)]">
            Reason <span>*</span>{" "}
            <span className="font-normal normal-case text-muted-foreground/70">
              (visible to the coach)
            </span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Roster is missing required players for 5v5 — please add at least 5 starters before resubmitting."
            className="w-full resize-none rounded-md border border-border bg-background p-2 text-[12px] focus:border-[color:var(--brand-crimson)] focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
              disabled={pending}
              className="rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium hover:bg-card disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={pending || reason.trim().length < 5}
              className="inline-flex items-center gap-1 rounded-md bg-[color:var(--brand-crimson)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ThumbsDown className="h-3 w-3" />
              {pending ? "Submitting…" : "Confirm reject"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode("rejecting")}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-50"
          >
            <ThumbsDown className="h-3 w-3" />
            Reject
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            {pending ? "Approving…" : "Approve"}
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Trophy;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}

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
