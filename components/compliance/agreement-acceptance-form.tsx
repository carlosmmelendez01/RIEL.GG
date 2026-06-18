"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileSignature,
  ShieldCheck,
} from "lucide-react";

import {
  acceptLeagueOperatorAgreement,
  acceptSchoolParticipationAgreement,
  type AgreementActionResult,
} from "@/lib/compliance/agreement-actions";
import { cn } from "@/lib/utils";

type AgreementKind = "school" | "league";

type CheckboxKey =
  | "authority"
  | "terms"
  | "privacy"
  | "dpa"
  | "educationalUse"
  | "parentConsentResponsibility"
  | "schoolsNotAutomaticallyBound";

type RequirementItem = {
  key: CheckboxKey;
  label: string;
  reviewLabel: string;
  reviewHref?: string;
  reviewText: string;
};

const SCHOOL_CHECKBOXES: RequirementItem[] = [
  {
    key: "authority",
    label: "I have reviewed this authority statement and certify I can act for this school or district.",
    reviewLabel: "Review authority",
    reviewText:
      "Only a person authorized by the school or district should accept this agreement. This may be a principal, athletic director, esports director, IT/data privacy lead, or a coach with delegated authority.",
  },
  {
    key: "terms",
    label: "I have read and agree to the ArcLight Terms of Service.",
    reviewLabel: "Open terms",
    reviewHref: "/terms",
    reviewText:
      "The Terms cover acceptable use, account responsibility, competition integrity, suspension, and platform access during beta.",
  },
  {
    key: "privacy",
    label: "I have read and acknowledge the ArcLight Privacy Policy.",
    reviewLabel: "Open privacy",
    reviewHref: "/privacy",
    reviewText:
      "The Privacy Policy explains student data categories, school-controlled use, FERPA/COPPA posture, retention, and deletion review.",
  },
  {
    key: "dpa",
    label: "I have read and accept the School Data Privacy Addendum for school-controlled use.",
    reviewLabel: "Open DPA",
    reviewHref: "/dpa",
    reviewText:
      "The DPA describes school direction, service-provider limits, subprocessors, security, exports, and deletion review.",
  },
  {
    key: "educationalUse",
    label: "I have reviewed and acknowledge the educational-use limits for student data.",
    reviewLabel: "Review limits",
    reviewText:
      "Student data in ArcLight is for school esports operations: roster eligibility, match operations, standings, communications, safety, support, and audit. It is not for advertising or sale.",
  },
  {
    key: "parentConsentResponsibility",
    label: "I have reviewed and acknowledge my school's parent/guardian consent responsibility.",
    reviewLabel: "Review consent",
    reviewText:
      "Schools or districts are responsible for deciding whether parent/guardian permission is required and recording consent before student participation where required.",
  },
];

const LEAGUE_CHECKBOXES: RequirementItem[] = [
  {
    key: "authority",
    label: "I have reviewed this authority statement and certify I can act for this league or association.",
    reviewLabel: "Review authority",
    reviewText:
      "Only an authorized league representative should accept this agreement. This may be a league owner, commissioner, director, or administrator with delegated authority.",
  },
  {
    key: "terms",
    label: "I have read and agree to the ArcLight Terms of Service.",
    reviewLabel: "Open terms",
    reviewHref: "/terms",
    reviewText:
      "The Terms cover acceptable use, account responsibility, competition integrity, suspension, and platform access during beta.",
  },
  {
    key: "privacy",
    label: "I have read and acknowledge the ArcLight Privacy Policy.",
    reviewLabel: "Open privacy",
    reviewHref: "/privacy",
    reviewText:
      "The Privacy Policy explains student data categories, school-controlled use, FERPA/COPPA posture, retention, and deletion review.",
  },
  {
    key: "dpa",
    label: "I have read and acknowledge the School Data Privacy Addendum template.",
    reviewLabel: "Open DPA",
    reviewHref: "/dpa",
    reviewText:
      "The DPA describes school direction, service-provider limits, subprocessors, security, exports, and deletion review.",
  },
  {
    key: "schoolsNotAutomaticallyBound",
    label: "I have reviewed and understand this does not automatically bind schools unless my league has authority to do so.",
    reviewLabel: "Review school coverage",
    reviewText:
      "A league acceptance can document league-level operations, but each school still needs direct authorization unless the league has a valid master agreement or other authority to cover that school.",
  },
];

export function AgreementAcceptanceForm({
  kind,
  entityId,
  entityName,
  signerName,
  signerEmail,
}: {
  kind: AgreementKind;
  entityId: string;
  entityName: string;
  signerName: string;
  signerEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(signerName);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState(signerEmail);
  const [coverageSource, setCoverageSource] = useState<
    "DIRECT_SCHOOL_AUTHORIZATION" | "LEAGUE_MASTER_AGREEMENT" | "PARENT_GUARDIAN_REQUIRED"
  >("DIRECT_SCHOOL_AUTHORIZATION");
  const [checked, setChecked] = useState<Record<CheckboxKey, boolean>>({
    authority: false,
    terms: false,
    privacy: false,
    dpa: false,
    educationalUse: false,
    parentConsentResponsibility: false,
    schoolsNotAutomaticallyBound: false,
  });
  const [reviewed, setReviewed] = useState<Record<CheckboxKey, boolean>>({
    authority: false,
    terms: false,
    privacy: false,
    dpa: false,
    educationalUse: false,
    parentConsentResponsibility: false,
    schoolsNotAutomaticallyBound: false,
  });
  const [expanded, setExpanded] = useState<Record<CheckboxKey, boolean>>({
    authority: false,
    terms: false,
    privacy: false,
    dpa: false,
    educationalUse: false,
    parentConsentResponsibility: false,
    schoolsNotAutomaticallyBound: false,
  });
  const [result, setResult] = useState<AgreementActionResult | null>(null);

  const checkboxes = kind === "school" ? SCHOOL_CHECKBOXES : LEAGUE_CHECKBOXES;
  const ready = useMemo(() => {
    return (
      name.trim().length > 1 &&
      title.trim().length > 1 &&
      email.trim().length > 3 &&
      checkboxes.every((item) => checked[item.key])
    );
  }, [checkboxes, checked, email, name, title]);

  function toggle(key: CheckboxKey) {
    if (!reviewed[key]) return;
    setChecked((current) => ({ ...current, [key]: !current[key] }));
  }

  function markReviewed(key: CheckboxKey) {
    setReviewed((current) => ({ ...current, [key]: true }));
    setExpanded((current) => ({ ...current, [key]: true }));
  }

  function submit() {
    setResult(null);
    startTransition(async () => {
      const response =
        kind === "school"
          ? await acceptSchoolParticipationAgreement({
              schoolId: entityId,
              signerName: name,
              signerTitle: title,
              signerEmail: email,
              coverageSource,
              attestations: {
                authority: checked.authority,
                terms: checked.terms,
                privacy: checked.privacy,
                dpa: checked.dpa,
                educationalUse: checked.educationalUse,
                parentConsentResponsibility: checked.parentConsentResponsibility,
              },
            })
          : await acceptLeagueOperatorAgreement({
              leagueId: entityId,
              signerName: name,
              signerTitle: title,
              signerEmail: email,
              attestations: {
                authority: checked.authority,
                terms: checked.terms,
                privacy: checked.privacy,
                dpa: checked.dpa,
                schoolsNotAutomaticallyBound: checked.schoolsNotAutomaticallyBound,
              },
            });

      setResult(response);
      if (response.ok) {
        router.push(response.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5 rounded-xl border border-border/60 bg-card/80 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
          <FileSignature className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Required before access
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {kind === "school" ? "School participation agreement" : "League operator agreement"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {entityName} needs a current agreement acceptance on file before the
            admin tools open.
          </p>
        </div>
      </div>

      {result?.ok ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[13px]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p>Agreement accepted. Opening the dashboard…</p>
        </div>
      ) : null}
      {result && !result.ok ? (
        <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[13px] text-[color:var(--brand-crimson)]">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{result.error}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Signer name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-[color:var(--brand-crimson)] disabled:opacity-60"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Title / role
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={pending}
            placeholder={kind === "school" ? "Athletic Director, Principal, Coach..." : "Director, Commissioner..."}
            className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-[color:var(--brand-crimson)] disabled:opacity-60"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Signer email
          </span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            type="email"
            className="h-10 w-full rounded-md border border-border/60 bg-background px-3 font-mono text-[12px] outline-none transition-colors focus:border-[color:var(--brand-crimson)] disabled:opacity-60"
          />
        </label>
      </div>

      {kind === "school" ? (
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Authority / consent coverage
          </span>
          <select
            value={coverageSource}
            onChange={(event) => setCoverageSource(event.target.value as typeof coverageSource)}
            disabled={pending}
            className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-[color:var(--brand-crimson)] disabled:opacity-60"
          >
            <option value="DIRECT_SCHOOL_AUTHORIZATION">School/district accepted directly</option>
            <option value="LEAGUE_MASTER_AGREEMENT">Covered by league master agreement</option>
            <option value="PARENT_GUARDIAN_REQUIRED">Parent/guardian consent required by school</option>
          </select>
        </label>
      ) : null}

      <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
        {checkboxes.map((item) => (
          <RequirementRow
            key={item.key}
            item={item}
            checked={checked[item.key]}
            reviewed={reviewed[item.key]}
            expanded={expanded[item.key]}
            disabled={pending}
            onToggle={() => toggle(item.key)}
            onReview={() => markReviewed(item.key)}
            onExpand={() =>
              setExpanded((current) => ({
                ...current,
                [item.key]: !current[item.key],
              }))
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/dpa" className="hover:text-foreground">DPA</Link>
        </div>
        <button
          type="button"
          disabled={!ready || pending || result?.ok}
          onClick={submit}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-crimson)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50 glow-crimson-sm",
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          {pending ? "Saving…" : "Accept and continue"}
        </button>
      </div>
    </div>
  );
}

function RequirementRow({
  item,
  checked,
  reviewed,
  expanded,
  disabled,
  onToggle,
  onReview,
  onExpand,
}: {
  item: RequirementItem;
  checked: boolean;
  reviewed: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onReview: () => void;
  onExpand: () => void;
}) {
  const checkboxDisabled = disabled || !reviewed;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-3 transition-colors",
        reviewed ? "border-border/60 bg-card/40" : "border-border/50 bg-background/50",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <label
          className={cn(
            "flex min-w-0 items-start gap-2 text-[13px]",
            checkboxDisabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
          )}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            disabled={checkboxDisabled}
            className="mt-0.5 h-4 w-4 accent-[color:var(--brand-crimson)] disabled:cursor-not-allowed disabled:opacity-45"
          />
          <span>{item.label}</span>
        </label>

        <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
          {reviewed ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-500">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Reviewed
            </span>
          ) : null}
          {item.reviewHref ? (
            <Link
              href={item.reviewHref}
              target="_blank"
              rel="noreferrer"
              onClick={onReview}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-[11px] font-semibold hover:bg-card"
            >
              {item.reviewLabel}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onReview}
              className="inline-flex h-7 items-center rounded-md border border-border/60 bg-background px-2 text-[11px] font-semibold hover:bg-card"
            >
              {reviewed ? "Review again" : item.reviewLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex h-7 items-center rounded-md px-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded ? (
        <p className="mt-2 pl-6 text-[12px] leading-relaxed text-muted-foreground">
          {item.reviewText}
        </p>
      ) : null}
    </div>
  );
}
