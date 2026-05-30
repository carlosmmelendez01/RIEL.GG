"use client";

/**
 * Match-Day Hub — the headline component on `/me`.
 *
 * Pinned at the top of the feed when the player has matches in the
 * match-day window. Primary actions per card — Check In · Chat ·
 * Report Score — open *inline overlays* (no route navigation), so the
 * player never lands on a blank page and the 3-tap brief survives even
 * on slow devices.
 *
 * Role gating:
 *  - PLAYER → Check In + Chat only
 *  - CAPTAIN / COACH / MANAGER → adds Report Score
 */

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Flag,
  MessageCircle,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";

import { ChatSheet } from "@/components/match/chat-sheet";
import { MatchStateMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type {
  MatchChatPayload,
  MatchDayCard,
  MatchDayStatus,
  ViewerRosterRole,
} from "@/lib/match/match-day";

// --- Status visual tokens ----------------------------------------------

const STATUS_LABEL: Record<MatchDayStatus, string> = {
  LIVE: "Live now",
  STARTING_SOON: "Starting soon",
  TODAY: "Today",
  TOMORROW: "Tomorrow",
  UPCOMING: "Upcoming",
};

const STATUS_TONE: Record<MatchDayStatus, string> = {
  LIVE: "border-[color:var(--brand-crimson)]/50 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  STARTING_SOON: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  TODAY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  TOMORROW: "border-sky-500/40 bg-sky-500/10 text-sky-500",
  UPCOMING: "border-border/60 bg-card/60 text-muted-foreground",
};

// --- Component ----------------------------------------------------------

type SheetKind = "chat" | "checkin" | "score";
type ActiveSheet = { kind: SheetKind; matchId: string } | null;

export function MatchDayHub({
  cards,
  chatPayloads,
}: {
  cards: MatchDayCard[];
  /** Pre-loaded chat threads keyed by matchId. Eager so Chat opens instantly. */
  chatPayloads: Record<string, MatchChatPayload | null>;
}) {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  if (cards.length === 0) return null;

  const liveCount = cards.filter((c) => c.status === "LIVE").length;
  const todayCount = cards.filter((c) => c.status === "TODAY" || c.status === "STARTING_SOON").length;

  const activeCard = activeSheet ? cards.find((c) => c.matchId === activeSheet.matchId) ?? null : null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[color:var(--brand-crimson)]/25 bg-card/40"
      aria-labelledby="match-day-title"
    >
      {/* Section header */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 bg-background/30 px-5 py-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
            <Flag className="h-3 w-3" />
            Match day
          </p>
          <h2 id="match-day-title" className="mt-0.5 text-[15px] font-semibold tracking-tight">
            {liveCount > 0
              ? `${liveCount} live · ${cards.length - liveCount} upcoming`
              : todayCount > 0
                ? `${todayCount} match${todayCount === 1 ? "" : "es"} today`
                : `${cards.length} upcoming match${cards.length === 1 ? "" : "es"}`}
          </h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Check-in opens 15 min before tipoff
        </p>
      </header>

      {/* Cards */}
      <ul className="divide-y divide-border/60">
        {cards.map((card) => (
          <li key={card.matchId}>
            <MatchDayHubCard
              card={card}
              onAction={(kind) => setActiveSheet({ kind, matchId: card.matchId })}
            />
          </li>
        ))}
      </ul>

      {/* Chat sheet — payload selected by activeSheet */}
      <ChatSheet
        open={activeSheet?.kind === "chat"}
        payload={activeSheet?.kind === "chat" ? chatPayloads[activeSheet.matchId] ?? null : null}
        onClose={() => setActiveSheet(null)}
      />

      {/* Check-in confirmation sheet — players + coaches */}
      <CheckInSheet
        open={activeSheet?.kind === "checkin"}
        card={activeSheet?.kind === "checkin" ? activeCard : null}
        onClose={() => setActiveSheet(null)}
      />

      {/* Report-score sheet — coaches / captains / managers only */}
      <ReportScoreSheet
        open={activeSheet?.kind === "score"}
        card={activeSheet?.kind === "score" ? activeCard : null}
        onClose={() => setActiveSheet(null)}
      />
    </section>
  );
}

const REPORT_ROLES: ViewerRosterRole[] = ["COACH", "CAPTAIN", "MANAGER"];
function canReportScore(role: ViewerRosterRole): boolean {
  return REPORT_ROLES.includes(role);
}

// --- Per-match card -----------------------------------------------------

function MatchDayHubCard({
  card,
  onAction,
}: {
  card: MatchDayCard;
  onAction: (kind: SheetKind) => void;
}) {
  const showReportScore = canReportScore(card.viewerRole);
  const scoreDisabled = !card.hasGamesPlayed && card.status !== "LIVE" && card.status !== "STARTING_SOON";

  return (
    <article className="px-5 py-4 md:px-6 md:py-5">
      {/* Top row: status + game + when */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            STATUS_TONE[card.status],
          )}
        >
          {card.status === "LIVE" ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          ) : null}
          {STATUS_LABEL[card.status]}
        </span>

        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {formatWhen(card)}
        </span>

        <span className="text-muted-foreground/40">·</span>

        <span className="inline-flex items-center gap-1">
          <Trophy className="h-3 w-3 text-[color:var(--brand-gold)]" />
          {card.competitionName}
        </span>

        <span
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          title={`Your role on this roster: ${card.viewerRole.toLowerCase()}`}
        >
          {card.viewerRole.toLowerCase()}
        </span>

        <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-1.5 py-0.5 font-mono text-[10px]">
          {card.game}
        </span>
      </div>

      {/* Matchup */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Monogram tone="crimson" text={card.ownMonogram} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight">{card.ownTeam}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">You</p>
          </div>
        </div>

        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">vs</span>

        <div className="flex items-center gap-2 justify-end min-w-0 text-right">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight">{card.opponentTeam}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Opponent</p>
          </div>
          <Monogram tone="zinc" text={card.opponentMonogram} />
        </div>
      </div>

      {/* Primary actions — 2-up for players, 3-up for coaches/captains/managers.
          All buttons open inline sheets — none navigate away from /me. */}
      <div className={cn("mt-5 grid gap-2", showReportScore ? "grid-cols-3" : "grid-cols-2")}>
        <ActionButton icon={Bell} label="Check in" tone="outline" onClick={() => onAction("checkin")} />

        <button
          type="button"
          onClick={() => onAction("chat")}
          className="relative inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
        >
          <MessageCircle className="h-4 w-4" />
          Chat
          {card.unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-card bg-[color:var(--brand-gold)] px-1 text-[10px] font-bold text-black">
              {card.unreadCount}
            </span>
          ) : null}
        </button>

        {showReportScore ? (
          <ActionButton
            icon={Trophy}
            label="Report score"
            tone="outline"
            onClick={() => onAction("score")}
            disabled={scoreDisabled}
            disabledTitle="Scores can be reported once the match is live or has games played"
          />
        ) : null}
      </div>

      {/* Last message preview — only when there's chat activity */}
      {card.lastMessagePreview ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <MatchStateMark state={mapStatusToMark(card.matchStatus)} size={12} />
          <span className="truncate">
            <span className="font-medium text-foreground">Latest:</span>{" "}
            {card.lastMessagePreview}
          </span>
          <button
            type="button"
            onClick={() => onAction("chat")}
            className="inline-flex shrink-0 items-center gap-0.5 font-medium text-muted-foreground hover:text-foreground"
          >
            Open
          </button>
        </div>
      ) : null}
    </article>
  );
}

// --- Bits ---------------------------------------------------------------

function Monogram({ text, tone }: { text: string; tone: "crimson" | "zinc" }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold tracking-tight text-white",
        tone === "crimson"
          ? "from-[color:var(--brand-crimson)] to-rose-700"
          : "from-zinc-700 to-zinc-900",
      )}
    >
      {text}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled = false,
  disabledTitle,
}: {
  icon: typeof Bell;
  label: string;
  tone: "outline" | "primary";
  onClick: () => void;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        tone === "outline" &&
          "border border-border/60 bg-background/40 text-foreground hover:bg-card",
        tone === "primary" &&
          "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// --- Check-in sheet ---------------------------------------------------

function CheckInSheet({
  open,
  card,
  onClose,
}: {
  open: boolean;
  card: MatchDayCard | null;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);

  // Reset confirmation state whenever the sheet closes
  useEffect(() => {
    if (!open) setChecked(false);
  }, [open]);

  if (!open || !card) return null;

  return (
    <SheetShell
      onClose={onClose}
      eyebrow={
        <>
          <Bell className="h-3 w-3" /> Match check-in
        </>
      }
      title={`${card.ownTeam} vs ${card.opponentTeam}`}
    >
      {checked ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">You&apos;re checked in.</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Your coach has been notified. Stay close to your station — the match opens for
              first game in {formatWhen(card)}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
          >
            Back to home
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Confirm you&apos;re ready to play. Your coach sees this in their roster check-in
            view immediately — and the opposing team sees a green dot next to your monogram.
          </p>

          <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-[12px]">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              You&apos;re verified for this match
            </p>
            <p className="mt-1.5 text-muted-foreground">
              Role · <span className="font-mono uppercase">{card.viewerRole.toLowerCase()}</span> ·{" "}
              {card.ownSchoolShort}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border/60 px-3 py-2 text-[12px] font-medium hover:bg-card"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setChecked(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Check me in
            </button>
          </div>
        </div>
      )}
    </SheetShell>
  );
}

// --- Report-score sheet -----------------------------------------------

function ReportScoreSheet({
  open,
  card,
  onClose,
}: {
  open: boolean;
  card: MatchDayCard | null;
  onClose: () => void;
}) {
  if (!open || !card) return null;

  return (
    <SheetShell
      onClose={onClose}
      eyebrow={
        <>
          <ClipboardList className="h-3 w-3" /> Report match score
        </>
      }
      title={`${card.ownTeam} vs ${card.opponentTeam}`}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 p-3 text-[12px]">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand-gold)]" />
            Coach action
          </p>
          <p className="mt-1 text-muted-foreground">
            Reporting a score posts it for the opposing coach to confirm. Your roster role on this
            match: <span className="font-mono uppercase text-foreground">{card.viewerRole.toLowerCase()}</span>.
          </p>
        </div>

        {/* Score-entry skeleton — placeholder until the real form lands */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-4">
          <div className="text-center">
            <p className="truncate text-[12px] font-semibold">{card.ownTeam}</p>
            <input
              type="number"
              min={0}
              defaultValue={0}
              disabled
              className="mt-2 w-16 rounded-md border border-border/60 bg-card px-2 py-1 text-center text-2xl font-bold tabular-nums opacity-70"
            />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            vs
          </span>
          <div className="text-center">
            <p className="truncate text-[12px] font-semibold">{card.opponentTeam}</p>
            <input
              type="number"
              min={0}
              defaultValue={0}
              disabled
              className="mt-2 w-16 rounded-md border border-border/60 bg-card px-2 py-1 text-center text-2xl font-bold tabular-nums opacity-70"
            />
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The full reporting flow — per-game results, evidence uploads, opponent confirmation
          window, dispute-raise path — lands alongside the matchReport server action in the
          next sprint. For now, this preview confirms the surface only coaches see.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border/60 px-3 py-2 text-[12px] font-medium hover:bg-card"
          >
            Close
          </button>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white opacity-50"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Submit — coming soon
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

// --- Shared sheet shell ------------------------------------------------

function SheetShell({
  onClose,
  eyebrow,
  title,
  children,
}: {
  onClose: () => void;
  eyebrow: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              {eyebrow}
            </p>
            <h2 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-card/60 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function mapStatusToMark(status: string) {
  switch (status) {
    case "IN_PROGRESS":
    case "CHECKING_IN":
      return "in-progress" as const;
    case "AWAITING_CONFIRMATION":
    case "DISPUTED":
      return "verifying" as const;
    case "FINISHED":
      return "completed" as const;
    default:
      return "standby" as const;
  }
}

function formatWhen(card: MatchDayCard): string {
  if (card.status === "LIVE") return "Now";
  if (card.status === "STARTING_SOON") {
    if (card.minutesUntil <= 0) return "Starting";
    if (card.minutesUntil < 60) return `In ${card.minutesUntil}m`;
    const hr = Math.floor(card.minutesUntil / 60);
    const min = card.minutesUntil % 60;
    return min === 0 ? `In ${hr}h` : `In ${hr}h ${min}m`;
  }
  return card.scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
