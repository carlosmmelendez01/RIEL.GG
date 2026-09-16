"use client";

/**
 * Invite-a-school dialog (league admin).
 *
 * Collects a contact name, their email, and the school name (+ optional city /
 * state), then calls `inviteSchoolToLeague`. On success it shows the claim link
 * the admin can share, and refreshes the directory so the new school appears.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Mail, Plus, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import {
  inviteSchoolToLeague,
  type InviteSchoolResult,
} from "@/lib/school/invite-school-action";
import { cn } from "@/lib/utils";

export function InviteSchoolDialog({
  leagueName,
}: {
  leagueName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<InviteSchoolResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolState, setSchoolState] = useState("");

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;
  const success = result?.ok ? result : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = success ? `${origin}${success.inviteUrl}` : "";

  function reset() {
    setResult(null);
    setContactName("");
    setContactEmail("");
    setSchoolName("");
    setSchoolCity("");
    setSchoolState("");
    setCopied(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setResult(null);
    startTransition(async () => {
      const r = await inviteSchoolToLeague({
        schoolName: schoolName.trim(),
        schoolCity: schoolCity.trim() || undefined,
        schoolState: schoolState.trim() || undefined,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
      });
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        className={cn(
          buttonVariants({ size: "sm" }),
          "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
        )}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Invite a school
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {success ? (
          <SuccessView
            success={success}
            fullUrl={fullUrl}
            copied={copied}
            onCopy={() => {
              navigator.clipboard?.writeText(fullUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            onInviteAnother={reset}
            onDone={() => setOpen(false)}
          />
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Invite a school to {leagueName}</DialogTitle>
              <DialogDescription>
                We&apos;ll create the school and email the contact a link to claim it and
                build their rosters.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <Field
                label="Contact name"
                value={contactName}
                onChange={setContactName}
                placeholder="Jordan Rivera"
                error={fieldErrors?.contactName}
                autoFocus
              />
              <Field
                label="Contact email"
                type="email"
                value={contactEmail}
                onChange={setContactEmail}
                placeholder="coach@school.org"
                error={fieldErrors?.contactEmail}
              />
              <Field
                label="School name"
                value={schoolName}
                onChange={setSchoolName}
                placeholder="Pendleton Heights High School"
                error={fieldErrors?.schoolName}
              />
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field
                  label="City"
                  value={schoolCity}
                  onChange={setSchoolCity}
                  placeholder="Pendleton"
                  optional
                />
                <Field
                  label="State"
                  value={schoolState}
                  onChange={setSchoolState}
                  placeholder="IN"
                  optional
                />
              </div>

              {result && !result.ok ? (
                <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-2.5 text-[12px] text-[color:var(--brand-crimson)]">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>{result.error}</p>
                </div>
              ) : null}
            </div>

            <div className="-mx-4 -mb-4 mt-5 flex justify-end gap-2 rounded-b-xl border-t bg-muted/40 p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-60",
                )}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {pending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessView({
  success,
  fullUrl,
  copied,
  onCopy,
  onInviteAnother,
  onDone,
}: {
  success: Extract<InviteSchoolResult, { ok: true }>;
  fullUrl: string;
  copied: boolean;
  onCopy: () => void;
  onInviteAnother: () => void;
  onDone: () => void;
}) {
  return (
    <div>
      <DialogHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <DialogTitle>Invite sent for {success.schoolName}</DialogTitle>
        <DialogDescription>
          {success.contactName} ({success.contactEmail}) can claim the school with the link
          below. If email is configured we also sent it to them — it expires in 30 days.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Claim link
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-[12px]">
            {fullUrl}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Mail className="h-3 w-3" />
          Sent to {success.contactEmail}
        </p>
      </div>

      <div className="-mx-4 -mb-4 mt-5 flex justify-end gap-2 rounded-b-xl border-t bg-muted/40 p-4">
        <button
          type="button"
          onClick={onInviteAnother}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Invite another
        </button>
        <button
          type="button"
          onClick={onDone}
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
          )}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  optional,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  optional?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1.5 text-[12px]">
        {label}
        {optional ? <span className="text-[10px] text-muted-foreground">optional</span> : null}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(error && "border-[color:var(--brand-crimson)]/60")}
      />
      {error ? (
        <p className="text-[11px] text-[color:var(--brand-crimson)]">{error}</p>
      ) : null}
    </div>
  );
}
