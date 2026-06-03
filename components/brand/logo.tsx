/**
 * RIEL.GG brand assets — wordmark, icon mark, and match-state variants.
 *
 * Source files live in `public/brand/` (real designer SVGs, not inline). We
 * use plain <img> instead of next/image because Next doesn't optimize SVGs
 * meaningfully and the file sizes (~700–900 bytes each) are already tiny.
 *
 * The icon has 5 state variants whose colors map to MatchStatus values:
 *   default      → crimson  (brand mark)
 *   completed    → green    (FINISHED)
 *   in-progress  → gold     (IN_PROGRESS / CHECKING_IN)
 *   standby      → gray     (SCHEDULED)
 *   verifying    → purple   (AWAITING_CONFIRMATION)
 *
 * Use `<MatchStateMark>` in match-status badges so the brand stays
 * consistent across the platform.
 */

import { cn } from "@/lib/utils";

// Aspect ratio of the match-state icon SVGs (pulled from their viewBox)
const ICON_ASPECT = 284.248 / 361.111; // ≈ 0.787 (taller than wide)

export type MatchStateName = "default" | "completed" | "in-progress" | "standby" | "verifying";

const STATE_TO_FILE: Record<MatchStateName, string> = {
  default: "/brand/icon.svg",
  completed: "/brand/state-completed.svg",
  "in-progress": "/brand/state-in-progress.svg",
  standby: "/brand/state-standby.svg",
  verifying: "/brand/state-verifying.svg",
};

const STATE_LABEL: Record<MatchStateName, string> = {
  default: "RIEL.GG",
  completed: "Match completed",
  "in-progress": "Match in progress",
  standby: "Match scheduled",
  verifying: "Match verifying",
};

/**
 * Square-ish brand mark — taller than wide. Used in tight contexts like
 * sidebar headers, the dev page, and marketing hero.
 */
export function RielMark({
  size = 36,
  state = "default",
  className,
}: {
  size?: number;
  state?: MatchStateName;
  className?: string;
}) {
  const width = Math.round(size * ICON_ASPECT);
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={STATE_TO_FILE[state]}
      alt={STATE_LABEL[state]}
      width={width}
      height={size}
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

/**
 * Match-state variant of the icon mark. Use inside status pills / badges so
 * the brand reinforces every match status.
 */
export function MatchStateMark({
  state,
  size = 14,
  className,
}: {
  state: Exclude<MatchStateName, "default">;
  size?: number;
  className?: string;
}) {
  return <RielMark state={state} size={size} className={className} />;
}

/**
 * The standalone gradient-R brand icon (square). Use as the app/favicon mark
 * and beside the wordmark to form the full logo lockup. The gradient reads on
 * both light and dark backgrounds, so it is never theme-flipped.
 */
export function RielIcon({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/brand/icon-mark.png"
      alt="RIEL.GG"
      width={size}
      height={size}
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

/**
 * Full RIEL.GG logo lockup — the gradient-R icon + the "RIEL.GG" wordmark
 * rendered as live text (no raster wordmark). "RIEL" takes the foreground
 * color (so it flips with the theme); ".GG" carries the brand gradient that
 * mirrors the R mark. Pass `icon={false}` for a wordmark-only treatment.
 */
export function RielLockup({
  className,
  height = 30,
  icon = true,
}: {
  className?: string;
  /** Nominal lockup height in px; drives icon size + wordmark font size. */
  height?: number;
  /** Show the gradient-R icon before the wordmark. Defaults on. */
  icon?: boolean;
}) {
  const fontSize = Math.round(height * 0.74);
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      {icon ? <RielIcon size={Math.round(height * 1.08)} /> : null}
      <span
        aria-label="RIEL.GG"
        style={{ fontSize, lineHeight: 1 }}
        className="select-none font-extrabold tracking-[-0.02em]"
      >
        <span className="text-foreground">RIEL</span>
        <span className="text-gradient-logo">.GG</span>
      </span>
    </span>
  );
}

/**
 * Map a Prisma `MatchStatus` enum value to the right state variant.
 * Centralized here so badges across the app stay in sync.
 */
export function matchStatusToState(status: string): Exclude<MatchStateName, "default"> {
  switch (status) {
    case "FINISHED":
      return "completed";
    case "IN_PROGRESS":
    case "CHECKING_IN":
      return "in-progress";
    case "AWAITING_CONFIRMATION":
    case "DISPUTED":
      return "verifying";
    case "SCHEDULED":
    case "FORFEITED":
    case "CANCELED":
    default:
      return "standby";
  }
}
