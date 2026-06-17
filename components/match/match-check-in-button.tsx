"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { checkInForMatch } from "@/lib/match/check-in-actions";
import { cn } from "@/lib/utils";

export function MatchCheckInButton({
  matchId,
  rosterMembershipIds,
  checkedIn = false,
  disabled = false,
  label,
  checkedLabel = "Checked in",
  className,
}: {
  matchId: string;
  rosterMembershipIds?: string[];
  checkedIn?: boolean;
  disabled?: boolean;
  label?: string;
  checkedLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const isCheckedIn = checkedIn || confirmed;
  const isDisabled = disabled || isCheckedIn || pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await checkInForMatch({ matchId, rosterMembershipIds });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setConfirmed(true);
            router.refresh();
          });
        }}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed",
          isCheckedIn
            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
            : "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-60",
          className,
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {isCheckedIn ? checkedLabel : label ?? "Check in"}
      </button>
      {error ? (
        <p className="max-w-[220px] text-right text-[10px] leading-snug text-[color:var(--brand-crimson)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
