"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, FileClock, LockKeyhole, Save, ShieldCheck, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  recordStudentConsent,
  requestStudentDeletion,
} from "@/lib/compliance/actions";
import type { SchoolComplianceStudent } from "@/lib/school/data";
import type { SchoolAgreementSummary } from "@/lib/school/data";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  ["PENDING", "Pending"],
  ["SCHOOL_AUTHORIZED", "School authorized"],
  ["PARENT_AUTHORIZED", "Parent authorized"],
  ["NOT_REQUIRED", "Not required"],
  ["REVOKED", "Revoked"],
  ["EXPIRED", "Expired"],
] as const;

const AGE_OPTIONS = [
  ["UNKNOWN", "Unknown"],
  ["UNDER_13", "Under 13"],
  ["AGE_13_TO_17", "13-17"],
  ["AGE_18_PLUS", "18+"],
] as const;

export function SchoolCompliancePanel({
  schoolId,
  viewerRole,
  agreementStatus,
  students,
}: {
  schoolId: string;
  viewerRole: "MANAGER" | "COACH";
  agreementStatus: SchoolAgreementSummary;
  students: SchoolComplianceStudent[];
}) {
  const canManage = viewerRole === "MANAGER";

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          FERPA / COPPA
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Student data controls
          <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {students.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            "rounded-md border p-3 text-[12px]",
            agreementStatus.accepted
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-[color:var(--brand-crimson)]/35 bg-[color:var(--brand-crimson)]/8",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">
                {agreementStatus.accepted
                  ? "School agreement on file"
                  : "School agreement required"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {agreementStatus.accepted
                  ? `${coverageLabel(agreementStatus.coverageSource)}${
                      agreementStatus.signerName ? ` · signed by ${agreementStatus.signerName}` : ""
                    }${
                      agreementStatus.acceptedAt
                        ? ` · ${agreementStatus.acceptedAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`
                        : ""
                    }`
                  : "A school manager must accept the participation and student data authorization before full school operations."}
              </p>
            </div>
            {canManage ? (
              <Link
                href={`/agreements/school/${schoolId}`}
                className="inline-flex h-8 items-center rounded-md border border-border/60 bg-card px-2.5 text-[12px] font-semibold hover:bg-background"
              >
                {agreementStatus.accepted ? "View status" : "Accept agreement"}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 p-3 text-[12px] text-muted-foreground">
          <p className="font-semibold text-foreground">Gate 1 controls are active.</p>
          <p className="mt-1">
            Students and captains need active consent before player surfaces and match actions.
            Deletion is a tracked request so league records are reviewed before removal.
          </p>
          {!canManage ? (
            <p className="mt-2 inline-flex items-center gap-1 text-[color:var(--brand-gold)]">
              <LockKeyhole className="h-3 w-3" />
              Only school managers can update consent or request deletion.
            </p>
          ) : null}
        </div>

        {students.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-4 text-center text-[12px] text-muted-foreground">
            No rostered students found for this school.
          </div>
        ) : (
          <ul className="space-y-2">
            {students.map((student) => (
              <li key={student.userId}>
                <StudentPrivacyRow
                  schoolId={schoolId}
                  student={student}
                  canManage={canManage}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StudentPrivacyRow({
  schoolId,
  student,
  canManage,
}: {
  schoolId: string;
  student: SchoolComplianceStudent;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(student.consentStatus ?? "PENDING");
  const [ageBand, setAgeBand] = useState(student.ageBand ?? "UNKNOWN");
  const [message, setMessage] = useState<string | null>(null);

  function saveConsent() {
    setMessage(null);
    startTransition(async () => {
      const result = await recordStudentConsent({
        schoolId,
        studentUserId: student.userId,
        status: status as (typeof STATUS_OPTIONS)[number][0],
        ageBand: ageBand as (typeof AGE_OPTIONS)[number][0],
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Saved");
      router.refresh();
    });
  }

  function requestDeletion() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestStudentDeletion({
        schoolId,
        studentUserId: student.userId,
        reason: "School manager requested review from the compliance panel.",
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Deletion request opened");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{student.name}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{student.email}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {student.teams.join(" · ")}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            activeStatus(status)
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
          )}
        >
          {status.toLowerCase().replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Age band
          </span>
          <select
            value={ageBand}
            disabled={!canManage || pending}
            onChange={(event) => setAgeBand(event.target.value)}
            className="h-8 w-full rounded-md border border-border/60 bg-card px-2 text-[12px] disabled:opacity-60"
          >
            {AGE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Consent status
          </span>
          <select
            value={status}
            disabled={!canManage || pending}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 w-full rounded-md border border-border/60 bg-card px-2 text-[12px] disabled:opacity-60"
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canManage || pending}
          onClick={saveConsent}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-2.5 text-[12px] font-semibold text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          Save consent
        </button>
        <Link
          href={`/dashboard/school/export/${student.userId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-card px-2.5 text-[12px] font-semibold hover:bg-background"
        >
          <Download className="h-3.5 w-3.5" />
          Export JSON
        </Link>
        <button
          type="button"
          disabled={!canManage || pending}
          onClick={requestDeletion}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 text-[12px] font-semibold text-orange-600 hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-orange-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Request deletion
        </button>
        {student.openRequestCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <FileClock className="h-3 w-3" />
            {student.openRequestCount} open request{student.openRequestCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {message ? (
          <span className="text-[11px] text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </div>
  );
}

function activeStatus(status: string) {
  return status === "SCHOOL_AUTHORIZED" || status === "PARENT_AUTHORIZED" || status === "NOT_REQUIRED";
}

function coverageLabel(source: string | null) {
  switch (source) {
    case "DIRECT_SCHOOL_AUTHORIZATION":
      return "Direct school authorization";
    case "LEAGUE_MASTER_AGREEMENT":
      return "Covered by league master agreement";
    case "PARENT_GUARDIAN_REQUIRED":
      return "Parent/guardian consent required";
    default:
      return "Agreement accepted";
  }
}
