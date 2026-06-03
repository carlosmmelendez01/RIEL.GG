"use client";

/**
 * Per-competition scheduling controls.
 *
 *  - "Generate schedule" → `runScheduler` writes the round-robin regular
 *    season (idempotent; locks once matches exist).
 *  - "Playoffs" → `generatePlayoffRound` seeds the bracket from standings,
 *    then advances winners one round at a time. Only shown when the
 *    competition actually has a single-elim playoff stage.
 */

import { useState, useTransition } from "react";
import {
  CalendarCheck,
  CircleAlert,
  Loader2,
  Sparkles,
  Trophy,
  Wand2,
} from "lucide-react";

import {
  generatePlayoffRound,
  runScheduler,
  type GeneratePlayoffResult,
  type RunSchedulerResult,
} from "@/lib/competition/competition-actions";
import { cn } from "@/lib/utils";

export function SchedulerTrigger({
  competitionId,
  hasMatches,
  rosterCount,
  hasPlayoffStage,
  compact,
}: {
  competitionId: string;
  /** True when the league-play stage already has match rows — locks the button. */
  hasMatches: boolean;
  /** Approved roster count — locks when < 2. */
  rosterCount: number;
  /** True when there's a single-elim stage to run playoffs on. */
  hasPlayoffStage?: boolean;
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
      <div className="flex flex-wrap items-center gap-2">
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

        {hasPlayoffStage ? (
          <PlayoffButton competitionId={competitionId} compact={compact} />
        ) : null}
      </div>

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

function PlayoffButton({
  competitionId,
  compact,
}: {
  competitionId: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GeneratePlayoffResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await generatePlayoffRound({ competitionId });
      setResult(r);
    });
  }

  const championDecided = result && !result.ok && result.code === "CHAMPION_DECIDED";

  return (
    <div className={cn("flex flex-col gap-1", compact ? "" : "items-start")}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || !!championDecided}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold)]/20",
          compact ? "px-2.5 py-1 text-[11px]" : "px-4 py-2.5 text-[13px]",
        )}
      >
        {pending ? (
          <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-4 w-4")} />
        ) : (
          <Trophy className={compact ? "h-3 w-3" : "h-4 w-4"} />
        )}
        {pending ? "Working…" : championDecided ? "Champion decided" : "Playoffs"}
      </button>

      {result?.ok ? (
        <p className={cn("flex items-center gap-1.5 text-emerald-500", compact ? "text-[10px]" : "text-[12px]")}>
          <Trophy className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {result.seeded ? "Seeded " : "Generated "}
          {result.roundName} · {result.matchesCreated} match
          {result.matchesCreated === 1 ? "" : "es"}.
        </p>
      ) : null}

      {result && !result.ok ? (
        <p
          className={cn(
            "flex items-start gap-1.5",
            championDecided ? "text-[color:var(--brand-gold)]" : "text-[color:var(--brand-crimson)]",
            compact ? "text-[10px]" : "text-[12px]",
          )}
        >
          {championDecided ? (
            <Trophy className={cn("mt-0.5 shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          ) : (
            <CircleAlert className={cn("mt-0.5 shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          )}
          <span>{result.error}</span>
        </p>
      ) : null}
    </div>
  );
}
