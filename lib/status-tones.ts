/**
 * RIEL.GG state-color system.
 *
 * Canonical mapping:
 *  - LIVE       → Red (crimson)         system is "powered on"
 *  - IN_PROGRESS → Orange/Yellow         operating but transitional
 *  - PENDING    → Purple                  awaiting input
 *  - COMPLETE   → Green                   done
 *  - DISPUTED   → Orange                  needs intervention
 *  - DRAFT/IDLE → Neutral                 not yet engaged
 *
 * Each tone exposes pill, dot, and surface variants so a tone applies
 * consistently across cards, badges, sidebar markers, etc.
 */

export type RielTone = "live" | "inProgress" | "pending" | "complete" | "disputed" | "neutral";

type ToneClasses = {
  pill: string; // border + bg + text — for status pills
  text: string; // foreground only — for icons and accents
  surface: string; // border + bg — for callout cards
  dot: string; // bg color for status dots
};

export const TONES: Record<RielTone, ToneClasses> = {
  live: {
    pill: "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/15 text-[color:var(--brand-crimson)]",
    text: "text-[color:var(--brand-crimson)]",
    surface: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/8",
    dot: "bg-[color:var(--brand-crimson)]",
  },
  inProgress: {
    pill: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/12 text-[color:var(--brand-gold)]",
    text: "text-[color:var(--brand-gold)]",
    surface: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/8",
    dot: "bg-[color:var(--brand-gold)]",
  },
  pending: {
    pill: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/12 text-[color:var(--brand-purple)]",
    text: "text-[color:var(--brand-purple)]",
    surface: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/8",
    dot: "bg-[color:var(--brand-purple)]",
  },
  complete: {
    pill: "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    text: "text-emerald-700 dark:text-emerald-400",
    surface: "border-emerald-500/30 bg-emerald-500/8",
    dot: "bg-emerald-500",
  },
  disputed: {
    pill: "border-orange-500/40 bg-orange-500/12 text-orange-700 dark:text-orange-400",
    text: "text-orange-700 dark:text-orange-400",
    surface: "border-orange-500/30 bg-orange-500/8",
    dot: "bg-orange-500",
  },
  neutral: {
    pill: "border-border bg-background text-muted-foreground",
    text: "text-muted-foreground",
    surface: "border-border bg-background",
    dot: "bg-muted-foreground",
  },
};

// --- Convenience mappings --------------------------------------------------

export type MatchStatus =
  | "SCHEDULED"
  | "CHECKING_IN"
  | "LIVE"
  | "IN_PROGRESS"
  | "AWAITING_REPORT"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "FINISHED"
  | "DISPUTED"
  | "FORFEITED"
  | "CANCELED";

export function matchTone(status: MatchStatus): RielTone {
  switch (status) {
    case "LIVE":
    case "IN_PROGRESS":
      return "live";
    case "CHECKING_IN":
    case "AWAITING_REPORT":
    case "AWAITING_CONFIRMATION":
      return "inProgress";
    case "SCHEDULED":
      return "pending";
    case "CONFIRMED":
    case "FINISHED":
      return "complete";
    case "DISPUTED":
      return "disputed";
    case "FORFEITED":
    case "CANCELED":
      return "neutral";
  }
}

export function matchStatusLabel(status: MatchStatus): string {
  const map: Record<MatchStatus, string> = {
    SCHEDULED: "Scheduled",
    CHECKING_IN: "Checking in",
    LIVE: "Live",
    IN_PROGRESS: "In progress",
    AWAITING_REPORT: "Awaiting report",
    AWAITING_CONFIRMATION: "Awaiting confirmation",
    CONFIRMED: "Confirmed",
    FINISHED: "Finished",
    DISPUTED: "Disputed",
    FORFEITED: "Forfeited",
    CANCELED: "Canceled",
  };
  return map[status];
}

// Competition state + status combine — for the admin competitions page.
export function competitionTone(state: string, status: string): { tone: RielTone; label: string } {
  if (state === "DRAFT") return { tone: "neutral", label: "Draft" };
  if (state === "COMPLETE") return { tone: "complete", label: "Complete" };
  if (status === "SEEDING") return { tone: "inProgress", label: "Seeding" };
  return { tone: "live", label: "Live" };
}
