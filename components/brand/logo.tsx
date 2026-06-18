/**
 * ArcLight brand assets.
 *
 * The primary mark lives in `public/brand/arclight-mark.png`. Match-state
 * indicators stay deliberately simple so they communicate status without
 * turning the product logo into a traffic light.
 */

import { cn } from "@/lib/utils";

const MARK_ASPECT = 504 / 430;

export type MatchStateName = "default" | "completed" | "in-progress" | "standby" | "verifying";

const STATE_LABEL: Record<MatchStateName, string> = {
  default: "ArcLight",
  completed: "Match completed",
  "in-progress": "Match in progress",
  standby: "Match scheduled",
  verifying: "Match verifying",
};

const STATE_COLOR: Record<Exclude<MatchStateName, "default">, string> = {
  completed: "var(--status-complete, #22c55e)",
  "in-progress": "var(--brand-cyan)",
  standby: "var(--muted-foreground)",
  verifying: "var(--brand-violet)",
};

export function ArcLightMark({
  size = 36,
  state = "default",
  className,
}: {
  size?: number;
  state?: MatchStateName;
  className?: string;
}) {
  if (state !== "default") {
    return (
      <span
        role="img"
        aria-label={STATE_LABEL[state]}
        className={cn("inline-block shrink-0 rounded-full ring-1 ring-white/15", className)}
        style={{ width: size, height: size, backgroundColor: STATE_COLOR[state] }}
      />
    );
  }

  return <ArcLightIcon size={size} className={className} />;
}

export function MatchStateMark({
  state,
  size = 14,
  className,
}: {
  state: Exclude<MatchStateName, "default">;
  size?: number;
  className?: string;
}) {
  return <ArcLightMark state={state} size={size} className={className} />;
}

/** The violet/cyan ArcLight mark, including its intentional near-black field. */
export function ArcLightIcon({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const width = Math.round(size * MARK_ASPECT);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/brand/arclight-mark.png"
      alt="ArcLight"
      width={width}
      height={size}
      className={cn("shrink-0 select-none rounded-[18%] object-cover", className)}
      draggable={false}
    />
  );
}

/** ArcLight mark plus a live-text wordmark. */
export function ArcLightLockup({
  className,
  height = 30,
  icon = true,
}: {
  className?: string;
  height?: number;
  icon?: boolean;
}) {
  const fontSize = Math.round(height * 0.72);

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      {icon ? <ArcLightIcon size={Math.round(height * 1.08)} /> : null}
      <span
        aria-label="ArcLight"
        style={{ fontSize, lineHeight: 1 }}
        className="select-none font-extrabold tracking-[-0.035em]"
      >
        <span className="text-foreground">Arc</span>
        <span className="text-gradient-logo">Light</span>
      </span>
    </span>
  );
}

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
