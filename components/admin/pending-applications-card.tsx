"use client";

/**
 * League-admin pending applications queue.
 *
 * Renders the list of pending `SchoolApplication` rows with approve / reject
 * actions. Approve fires immediately (with an optional notes prompt expanded
 * inline); reject requires a 5+ char reason that gets attached to the audit
 * log and surfaced to the applicant later via email.
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
  Copy,
  GraduationCap,
  Link2,
  Mail,
  ShieldCheck,
  ThumbsDown,
  UserCheck,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveSchoolApplication,
  rejectSchoolApplication,
  type ApproveApplicationResult,
  type RejectApplicationResult,
} from "@/lib/school/application-actions";
import type { PendingApplicationRow } from "@/lib/league-admin/dashboard";

export function PendingApplicationsCard({
  applications,
}: {
  applications: PendingApplicationRow[];
}) {
  return (
    <Card className="border-[color:var(--brand-gold)]/30 bg-card/60">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[color:var(--brand-gold)]">
          Approval queue
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-[color:var(--brand-gold)]" />
          Pending school applications
          <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {applications.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <UserCheck className="mx-auto h-5 w-5 text-emerald-500" />
            <p className="mt-2 text-[13px] font-semibold">All caught up.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              When a school submits an application via{" "}
              <span className="font-mono">/join</span>, it lands here for your review.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {applications.map((app) => (
              <li key={app.id}>
                <ApplicationRow app={app} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Single row --------------------------------------------------------

function ApplicationRow({ app }: { app: PendingApplicationRow }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"idle" | "rejecting" | "approved" | "rejected">("idle");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approvedInvite, setApprovedInvite] = useState<{ url: string; email: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const r: ApproveApplicationResult = await approveSchoolApplication({
        applicationId: app.id,
      });
      if (r.ok) {
        setApprovedInvite({ url: r.inviteUrl, email: app.coachEmail });
        setMode("approved");
      } else {
        setError(r.error);
      }
    });
  }

  function handleReject() {
    if (rejectReason.trim().length < 5) {
      setError("Add a reason (5+ chars).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r: RejectApplicationResult = await rejectSchoolApplication({
        applicationId: app.id,
        reason: rejectReason.trim(),
      });
      if (r.ok) setMode("rejected");
      else setError(r.error);
    });
  }

  if (mode === "approved" && approvedInvite) {
    return <ApprovedInviteCard app={app} invite={approvedInvite} />;
  }
  if (mode === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 p-3 text-[12px]">
        <X className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="font-semibold">{app.schoolName}</span> — rejected. Refreshing…
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
          {(app.schoolCode ?? app.schoolShort ?? app.schoolName.slice(0, 3)).toUpperCase().slice(0, 3)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-[14px] font-semibold">{app.schoolName}</p>
            {app.ncesId ? (
              <span className="inline-flex items-center gap-0.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <GraduationCap className="h-2.5 w-2.5" />
                NCES
              </span>
            ) : null}
            {app.hasExistingSchool ? (
              <span className="inline-flex items-center gap-0.5 rounded-sm border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-[color:var(--brand-purple)]">
                Existing record
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {app.schoolCity ? `${app.schoolCity}${app.schoolState ? `, ${app.schoolState}` : ""} · ` : ""}
            applied {timeAgo(app.createdAt)}
          </p>
          <p className="mt-1 truncate text-[12px]">
            <span className="text-muted-foreground">Contact:</span>{" "}
            <span className="font-medium">{app.coachName}</span>{" "}
            <span className="text-muted-foreground">({app.coachRole})</span>{" "}
            · <span className="font-mono text-[11px]">{app.coachEmail}</span>
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
          <DetailRow icon={Building2} label="School">
            {app.schoolName}
            {app.schoolShort ? <span className="text-muted-foreground"> · {app.schoolShort}</span> : null}
          </DetailRow>
          {app.ncesId ? (
            <DetailRow icon={GraduationCap} label="NCES ID">
              <span className="font-mono">{app.ncesId}</span>
            </DetailRow>
          ) : null}
          <DetailRow icon={Mail} label="Coach">
            {app.coachName} ({app.coachRole}){" — "}
            <span className="font-mono text-[11px]">{app.coachEmail}</span>
          </DetailRow>
          <DetailRow icon={Clock} label="Submitted">
            {app.createdAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </DetailRow>
          {app.reason ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Coach&apos;s note
              </p>
              <p className="mt-1 whitespace-pre-line rounded-md border border-border/60 bg-card/40 p-2 text-[12px]">
                {app.reason}
              </p>
            </div>
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
              (visible to the applicant)
            </span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="School isn't in our region this season — please apply to the Ohio league instead."
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
              disabled={pending || rejectReason.trim().length < 5}
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
  icon: typeof Building2;
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

// --- Approval success ---------------------------------------------------

function ApprovedInviteCard({
  app,
  invite,
}: {
  app: PendingApplicationRow;
  invite: { url: string; email: string };
}) {
  const [copied, setCopied] = useState(false);
  // Build the absolute URL only on the client — using window keeps it correct
  // across dev / staging / prod without us baking in the origin.
  const absoluteUrl =
    typeof window !== "undefined" ? `${window.location.origin}${invite.url}` : invite.url;

  function handleCopy() {
    navigator.clipboard.writeText(absoluteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <div>
          <p className="text-[13px] font-semibold">
            Approved — {app.schoolName} is in the league.
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Now send <span className="font-mono">{invite.email}</span> the link below so
            they can claim ownership. Expires in 30 days.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background p-2">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          readOnly
          value={absoluteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 truncate bg-transparent font-mono text-[11px] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-background"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Email integration is coming. Until then, paste this link into your usual
        coach-onboarding email.
      </p>
    </div>
  );
}

// --- Helpers -----------------------------------------------------------

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
