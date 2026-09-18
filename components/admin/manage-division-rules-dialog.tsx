"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleAlert,
  Eye,
  Plus,
  SlidersHorizontal,
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
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import {
  previewLeagueDivisionRules,
  updateLeagueDivisionRules,
} from "@/lib/league/division-actions";
import type {
  DivisionOption,
  DivisionRuleOption,
  DivisionRulePreview,
} from "@/lib/classification/season-service";
import { cn } from "@/lib/utils";

type EditableRule = {
  key: string;
  id?: string;
  divisionId: string;
  schoolLevel: "ELEMENTARY" | "MIDDLE" | "HIGH" | "OTHER";
  minimumEnrollment: string;
  maximumEnrollment: string;
};

let newRuleSequence = 0;

function editableRules(rules: DivisionRuleOption[]): EditableRule[] {
  return rules.map((rule) => ({
    key: rule.id,
    id: rule.id,
    divisionId: rule.divisionId ?? "NO_DIVISION",
    schoolLevel: rule.schoolLevel,
    minimumEnrollment: rule.minimumEnrollment?.toString() ?? "",
    maximumEnrollment: rule.maximumEnrollment?.toString() ?? "",
  }));
}

export function ManageDivisionRulesDialog({
  leagueName,
  season,
  divisions,
  rules,
}: {
  leagueName: string;
  season: { id: string; name: string } | null;
  divisions: DivisionOption[];
  rules: DivisionRuleOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EditableRule[]>(() => editableRules(rules));
  const [preview, setPreview] = useState<DivisionRulePreview | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeDivisions = divisions.filter((division) => division.active);

  function reset() {
    setRows(editableRules(rules));
    setPreview(null);
    setStatus("idle");
    setMessage(null);
  }

  function markChanged() {
    setPreview(null);
    setStatus("idle");
    setMessage(null);
  }

  function updateRow(index: number, patch: Partial<EditableRule>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
    markChanged();
  }

  function addRow() {
    newRuleSequence += 1;
    setRows((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${newRuleSequence}`,
        schoolLevel: "HIGH",
        divisionId: activeDivisions[0]?.id ?? "NO_DIVISION",
        minimumEnrollment: "",
        maximumEnrollment: "",
      },
    ]);
    markChanged();
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    markChanged();
  }

  function buildInput() {
    if (!season) throw new Error("Create a season before configuring division rules.");
    if (rows.length === 0) throw new Error("Add at least one division rule.");

    return {
      seasonId: season.id,
      rules: rows.map((row, index) => ({
        id: row.id,
        divisionId: row.divisionId === "NO_DIVISION" ? null : row.divisionId,
        schoolLevel: row.schoolLevel,
        minimumEnrollment: parseEnrollment(row.minimumEnrollment, index, "minimum"),
        maximumEnrollment: parseEnrollment(row.maximumEnrollment, index, "maximum"),
      })),
    };
  }

  function handlePreview() {
    setStatus("idle");
    setMessage(null);
    let input: ReturnType<typeof buildInput>;
    try {
      input = buildInput();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Check the rule list.");
      return;
    }

    startTransition(async () => {
      const result = await previewLeagueDivisionRules(input);
      if (result.ok) {
        setPreview(result.preview);
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    });
  }

  function handleSave() {
    setStatus("idle");
    setMessage(null);
    let input: ReturnType<typeof buildInput>;
    try {
      input = buildInput();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Check the rule list.");
      return;
    }

    startTransition(async () => {
      const result = await updateLeagueDivisionRules(input);
      if (result.ok) {
        setRows(editableRules(result.rules));
        setStatus("saved");
        setMessage(
          result.warning ??
            `Rules saved. ${result.classified} current school${result.classified === 1 ? " was" : "s were"} classified.`,
        );
        router.refresh();
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
        Classification rules
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Division classification rules</DialogTitle>
          <DialogDescription>
            Preview how {leagueName}&apos;s current member schools classify before saving rules for{" "}
            {season?.name ?? "the current season"}.
          </DialogDescription>
        </DialogHeader>

        {!season ? (
          <Notice tone="error">Create a season before configuring classification rules.</Notice>
        ) : activeDivisions.length === 0 ? (
          <Notice tone="error">Add at least one active division before configuring rules.</Notice>
        ) : (
          <>
            <div className="mt-2 space-y-3">
              {rows.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-5 text-center">
                  <p className="text-[13px] font-medium">No rules configured.</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Add one rule for each school level and enrollment range the league supports.
                  </p>
                </div>
              ) : (
                rows.map((row, index) => (
                  <RuleEditorRow
                    key={row.key}
                    index={index}
                    row={row}
                    divisions={activeDivisions}
                    onChange={(patch) => updateRow(index, patch)}
                    onRemove={() => removeRow(index)}
                  />
                ))
              )}
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= 40}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1 w-full")}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add rule
            </button>

            {preview ? <PreviewPanel preview={preview} /> : null}

            {message ? (
              <Notice tone={status === "saved" ? "success" : "error"}>{message}</Notice>
            ) : null}

            <div className="-mx-4 -mb-4 mt-2 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/40 p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={pending || rows.length === 0}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                {pending ? "Working..." : "Preview impact"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending || !preview}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-60",
                )}
              >
                {pending ? "Saving..." : "Save and classify"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RuleEditorRow({
  index,
  row,
  divisions,
  onChange,
  onRemove,
}: {
  index: number;
  row: EditableRule;
  divisions: DivisionOption[];
  onChange: (patch: Partial<EditableRule>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Rule {index + 1}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-[color:var(--brand-crimson)]/30 p-1.5 text-[color:var(--brand-crimson)] transition-colors hover:bg-[color:var(--brand-crimson)]/10"
          aria-label={`Remove rule ${index + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`${row.key}-level`} className="text-[11px]">School level</Label>
          <select
            id={`${row.key}-level`}
            value={row.schoolLevel}
            onChange={(event) =>
              onChange({ schoolLevel: event.target.value as EditableRule["schoolLevel"] })
            }
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="ELEMENTARY">Elementary</option>
            <option value="MIDDLE">Middle</option>
            <option value="HIGH">High</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${row.key}-division`} className="text-[11px]">Placement</Label>
          <select
            id={`${row.key}-division`}
            value={row.divisionId}
            onChange={(event) => onChange({ divisionId: event.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="NO_DIVISION">No division</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>{division.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${row.key}-minimum`} className="text-[11px]">Minimum</Label>
          <Input
            id={`${row.key}-minimum`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={row.minimumEnrollment}
            onChange={(event) => onChange({ minimumEnrollment: event.target.value })}
            placeholder="No minimum"
            className="text-[12px]"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${row.key}-maximum`} className="text-[11px]">Maximum</Label>
          <Input
            id={`${row.key}-maximum`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={row.maximumEnrollment}
            onChange={(event) => onChange({ maximumEnrollment: event.target.value })}
            placeholder="No maximum"
            className="text-[12px]"
          />
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({ preview }: { preview: DivisionRulePreview }) {
  const classified = preview.rows.filter((row) => row.status === "CLASSIFIED").length;
  const noDivision = preview.rows.filter((row) => row.status === "NO_DIVISION").length;
  const attention = preview.rows.length - classified - noDivision;

  return (
    <section className="mt-2 rounded-lg border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-purple)]">
            Preview · no changes saved
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">{preview.seasonName}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-400">
            {classified} classified
          </span>
          <span className="rounded-sm border border-border bg-background/60 px-2 py-1 text-muted-foreground">
            {noDivision} no division
          </span>
          <span className="rounded-sm border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 px-2 py-1 text-[color:var(--brand-gold)]">
            {attention} need attention
          </span>
        </div>
      </div>

      <div className="mt-3 max-h-56 divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60 bg-background/50">
        {preview.rows.length === 0 ? (
          <p className="p-3 text-[11px] text-muted-foreground">No active member schools to preview.</p>
        ) : (
          preview.rows.map((row) => (
            <div key={row.schoolId} className="grid gap-1 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium">{row.schoolName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatSchoolLevel(row.schoolLevel)} · {row.enrollment ?? "No grades 9-12 enrollment"}
                </p>
              </div>
              <p className={cn(
                "text-[11px] font-semibold",
                row.status === "CLASSIFIED" && "text-emerald-600 dark:text-emerald-400",
                row.status === "NO_DIVISION" && "text-muted-foreground",
                row.status !== "CLASSIFIED" && row.status !== "NO_DIVISION" && "text-[color:var(--brand-gold)]",
              )}>
                {row.divisionName ?? statusLabel(row.status)}
              </p>
              <p className="text-[10px] leading-relaxed text-muted-foreground sm:col-span-2">
                {row.explanation}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "mt-3 flex items-start gap-2 rounded-md border p-2.5 text-[11px]",
      tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
        : "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 text-[color:var(--brand-crimson)]",
    )}>
      {tone === "success" ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <p>{children}</p>
    </div>
  );
}

function parseEnrollment(value: string, index: number, label: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Rule ${index + 1} needs a whole-number ${label} enrollment.`);
  }
  return parsed;
}

function formatSchoolLevel(level: EditableRule["schoolLevel"] | null) {
  if (!level) return "School level missing";
  return `${level.charAt(0)}${level.slice(1).toLowerCase()}`;
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
