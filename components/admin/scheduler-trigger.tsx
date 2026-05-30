"use client";

/**
 * Per-competition "Generate schedule" button.
 *
 * Calls `runScheduler` on the server, which writes a round-robin set of
 * Match rows for the competition's first round-robin stage. The action is
 * idempotent — already-scheduled stages return an error instead of being
 * overwritten.
 */

import { useState, useTransition } from "react";
import {
  CalendarCheck,
  CircleAlert,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";

import {
  runScheduler,
  type RunSchedulerResult,
} from "@/lib/competition/competition-actions";
import { cn } from "@/lib/utils";

export function SchedulerTrigger({
  competitionId,
  hasMatches,
  rosterCount,
  compact,
}: {
  competitionId: string;
  /** True when the league-play stage already has match rows — locks the button. */
  hasMatches: boolean;
  /** Approved roster count — locks when < 2. */
  rosterCount: number;
  /** Smaller variant for inline rows. */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RunSchedulerResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await runScheduler({ competitionId });
      setResult(r);
    });
  }

  const tooSmall = rosterCount < 2;
  const disabled = pending || hasMatches || tooSmall;
  const disabledReason = hasMatches
    ? "Schedule already generated for this competition."
    : tooSmall
      ? `Need at least 2 approved rosters (have ${rosterCount}).`
      : undefined;

  return (
    <div className={cn("flex flex-col gap-2", compact ? "" : "items-start")}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          compact
            ? "bg-[color:var(--brand-purple)] px-2.5 py-1 text-[11px] hover:bg-[color:var(--brand-purple)]/90"
            : "bg-[color:var(--brand-crimson)] px-4 py-2.5 text-[13px] hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
        )}
      >
        {pending ? (
          <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-4 w-4")} />
        ) : result?.ok ? (
          <CalendarCheck className={compact ? "h-3 w-3" : "h-4 w-4"} />
        ) : (
          <Wand2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
        )}
        {pending
          ? "Generating…"
          : result?.ok
            ? "Generated"
            : hasMatches
              ? "Schedule generated"
              : compact
                ? "Generate"
                : "Generate schedule"}
      </button>

      {result?.ok ? (
        <p className={cn("flex items-center gap-1.5 text-emerald-500", compact ? "text-[10px]" : "text-[12px]")}>
          <Sparkles className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {result.matchesCreated} match{result.matchesCreated === 1 ? "" : "es"} across{" "}
          {result.roundsCreated} round{result.roundsCreated === 1 ? "" : "s"}.
        </p>
      ) : null}

      {result && !result.ok ? (
        <p className={cn("flex items-start gap-1.5 text-[color:var(--brand-crimson)]", compact ? "text-[10px]" : "text-[12px]")}>
          <CircleAlert className={cn("mt-0.5 shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          <span>{result.error}</span>
        </p>
      ) : null}
    </div>
  );
}
