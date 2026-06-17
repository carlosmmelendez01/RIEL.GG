"use client";

import { useState, useTransition } from "react";

import { updateSchoolDivision } from "@/lib/school/division-actions";
import type { LeagueDivisionOption } from "@/lib/league/divisions";
import { cn } from "@/lib/utils";

export function SchoolDivisionSelect({
  schoolId,
  schoolName,
  value,
  options,
}: {
  schoolId: string;
  schoolName: string;
  value: string | null;
  options: LeagueDivisionOption[];
}) {
  const [selected, setSelected] = useState(value ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(nextDivision: string) {
    const previous = selected;
    setSelected(nextDivision);
    setStatus("idle");
    setError(null);

    if (!nextDivision) {
      setSelected(previous);
      setStatus("error");
      setError("Choose a division.");
      return;
    }

    startTransition(async () => {
      const result = await updateSchoolDivision({
        schoolId,
        division: nextDivision,
      });

      if (result.ok) {
        setSelected(result.division);
        setStatus("saved");
        setError(null);
      } else {
        setSelected(previous);
        setStatus("error");
        setError(result.error);
      }
    });
  }

  const selectedOption = options.find((option) => option.value === selected);

  return (
    <div className="mt-2 space-y-1">
      <label className="sr-only" htmlFor={`division-${schoolId}`}>
        Division for {schoolName}
      </label>
      <select
        id={`division-${schoolId}`}
        value={selected}
        onChange={(event) => handleChange(event.target.value)}
        disabled={pending}
        className={cn(
          "h-8 w-full rounded-md border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5 px-2 text-[11px] font-semibold text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-70",
          !selected && "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10",
          status === "error" && "border-[color:var(--brand-crimson)]/60 bg-[color:var(--brand-crimson)]/10",
        )}
      >
        <option value="">Choose division</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p
        className={cn(
          "min-h-4 text-[10px] text-muted-foreground",
          status === "saved" && "text-emerald-600 dark:text-emerald-400",
          status === "error" && "text-[color:var(--brand-crimson)]",
        )}
      >
        {pending
          ? "Saving..."
          : status === "saved"
            ? "Saved"
            : status === "error"
              ? error
              : selectedOption?.description ?? "Required for league placement."}
      </p>
    </div>
  );
}
