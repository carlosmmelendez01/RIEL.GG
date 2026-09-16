"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Check, Pencil } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { overrideSchoolClassification } from "@/lib/school/division-actions";
import type { DivisionOption } from "@/lib/classification/season-service";
import type { LeagueSchoolRow } from "@/lib/league-admin/dashboard";
import { cn } from "@/lib/utils";

type Classification = NonNullable<LeagueSchoolRow["classification"]>;

export function SchoolClassificationOverride({
  schoolId,
  schoolName,
  classification,
  divisions,
}: {
  schoolId: string;
  schoolName: string;
  classification: Classification | null;
  divisions: DivisionOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [divisionId, setDivisionId] = useState(classification?.divisionId ?? "NO_DIVISION");
  const [reason, setReason] = useState("");

  if (!classification) {
    return (
      <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-2 text-[11px] text-muted-foreground">
        No season classification.
      </div>
    );
  }
  const current = classification;

  function reset() {
    setError(null);
    setSaved(false);
    setDivisionId(current.divisionId ?? "NO_DIVISION");
    setReason("");
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await overrideSchoolClassification({
        seasonId: current.seasonId,
        schoolId,
        divisionId: divisionId === "NO_DIVISION" ? null : divisionId,
        reason,
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const activeDivisions = divisions.filter((division) => division.active);
  const badge = current.method === "ADMIN_OVERRIDE"
    ? "Manual"
    : current.divisionName ?? statusLabel(current.status);

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-background/40 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-sm border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[color:var(--brand-purple)]">
              {badge}
            </span>
            {current.reviewNeeded ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
                <CircleAlert className="h-2.5 w-2.5" />
                Review
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {current.explanation}
          </p>
          {current.reviewReason ? (
            <p className="mt-1 text-[10px] leading-snug text-[color:var(--brand-gold)]">
              {current.reviewReason}
            </p>
          ) : null}
        </div>

        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) reset();
          }}
        >
          <DialogTrigger
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2")}
            title={`Override classification for ${schoolName}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Override</span>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{schoolName}</DialogTitle>
              <DialogDescription>{current.seasonName}</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px]">Effective division</Label>
                <select
                  value={divisionId}
                  onChange={(event) => setDivisionId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="NO_DIVISION">No division</option>
                  {activeDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[12px]">Reason</Label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-2.5 text-[11px] text-[color:var(--brand-crimson)]">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              {saved ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  Override saved.
                </div>
              ) : null}
            </div>

            <div className="-mx-4 -mb-4 mt-5 flex justify-end gap-2 rounded-b-xl border-t bg-muted/40 p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending || reason.trim().length < 5}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-60",
                )}
              >
                {pending ? "Saving..." : "Save override"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
