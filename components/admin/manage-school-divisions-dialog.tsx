"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { updateLeagueDivisions } from "@/lib/league/division-actions";
import type { LeagueDivisionOption } from "@/lib/league/divisions";
import { cn } from "@/lib/utils";

type EditableDivision = LeagueDivisionOption & { key: string };

let newDivisionSequence = 0;

function editableOptions(options: LeagueDivisionOption[]): EditableDivision[] {
  return options.map((option) => ({ ...option, key: option.value }));
}

export function ManageSchoolDivisionsDialog({
  leagueName,
  options,
}: {
  leagueName: string;
  options: LeagueDivisionOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EditableDivision[]>(() => editableOptions(options));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setRows(editableOptions(options));
    setStatus("idle");
    setError(null);
  }

  function updateRow(index: number, patch: Partial<EditableDivision>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
    setStatus("idle");
    setError(null);
  }

  function addRow() {
    newDivisionSequence += 1;
    setRows((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${newDivisionSequence}`,
        value: "",
        label: "",
      },
    ]);
    setStatus("idle");
    setError(null);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setStatus("idle");
    setError(null);
  }

  function moveRow(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= rows.length) return;

    setRows((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
    setStatus("idle");
    setError(null);
  }

  function handleSave() {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await updateLeagueDivisions({
        divisions: rows.map((row) => ({
          value: row.value || undefined,
          label: row.label.trim(),
          description: row.description?.trim() || undefined,
        })),
      });

      if (result.ok) {
        setRows(editableOptions(result.divisions));
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  const hasBlankLabel = rows.some((row) => !row.label.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
        Manage divisions
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>School divisions</DialogTitle>
          <DialogDescription>
            Configure the divisions {leagueName} uses for school placement. Changes apply to
            invites, application approvals, and the school directory.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-5 text-center">
              <p className="text-[13px] font-medium">No divisions configured.</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                School invites will not require a division until one is added.
              </p>
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border/60 bg-background/50 p-2.5"
              >
                <div className="min-w-0 space-y-2">
                  <Input
                    value={row.label}
                    onChange={(event) => updateRow(index, { label: event.target.value })}
                    placeholder="Division name"
                    aria-label={`Division ${index + 1} name`}
                    maxLength={60}
                    className="h-8 text-[12px] font-medium"
                  />
                  <Input
                    value={row.description ?? ""}
                    onChange={(event) => updateRow(index, { description: event.target.value })}
                    placeholder="Optional description"
                    aria-label={`Division ${index + 1} description`}
                    maxLength={160}
                    className="h-8 text-[11px] text-muted-foreground"
                  />
                </div>
                <div className="flex items-center gap-1 self-start">
                  <button
                    type="button"
                    onClick={() => moveRow(index, -1)}
                    disabled={index === 0}
                    className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label={`Move ${row.label || `division ${index + 1}`} up`}
                    title="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === rows.length - 1}
                    className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label={`Move ${row.label || `division ${index + 1}`} down`}
                    title="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="rounded-md border border-[color:var(--brand-crimson)]/30 p-1.5 text-[color:var(--brand-crimson)] transition-colors hover:bg-[color:var(--brand-crimson)]/10"
                    aria-label={`Remove ${row.label || `division ${index + 1}`}`}
                    title="Remove division"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= 12}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 w-full")}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add division
        </button>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Renaming or reordering keeps school assignments intact. A division cannot be removed
          until its schools are reassigned.
        </p>

        {status === "error" ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-2.5 text-[11px] text-[color:var(--brand-crimson)]">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {status === "saved" ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Divisions saved.
          </div>
        ) : null}

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
            disabled={pending || hasBlankLabel}
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-60",
            )}
          >
            {pending ? "Saving..." : "Save divisions"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
