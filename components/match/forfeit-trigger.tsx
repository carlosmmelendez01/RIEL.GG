"use client";

/**
 * Coach-side entry point for the forfeit wizard. Renders a small "danger
 * zone" card with the trigger button and manages the wizard's open state.
 *
 * Pass match identity + the side the current coach is on. For pages that
 * still read from mocks (no real RosterMembership lookup), pass `side="HOME"`
 * as a placeholder — when those pages migrate to real data, the resolver
 * picks `side` from the viewer's RosterMembership.
 */

import { useState } from "react";
import { Flag, ShieldAlert } from "lucide-react";

import { ForfeitWizard } from "@/components/match/forfeit-wizard";

export function ForfeitTrigger({
  matchId,
  side,
  ownTeamLabel,
  opponentTeamLabel,
  opponentCoachEmail = null,
  alreadyForfeited = false,
}: {
  matchId: string;
  side: "HOME" | "AWAY";
  ownTeamLabel: string;
  opponentTeamLabel: string;
  opponentCoachEmail?: string | null;
  alreadyForfeited?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-[color:var(--brand-crimson)]/25 bg-card/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              Match continuity
            </p>
            <h3 className="mt-0.5 text-[15px] font-semibold">Can&apos;t play this match?</h3>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
              Try to reschedule with the opposing coach first. If a forfeit is unavoidable, submit
              one here — we&apos;ll record it for the league office and notify the other team.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={alreadyForfeited}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 px-3 py-2 text-[12px] font-semibold text-[color:var(--brand-crimson)] transition-colors hover:bg-[color:var(--brand-crimson)]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Flag className="h-3.5 w-3.5" />
          {alreadyForfeited ? "Forfeit already submitted" : "Submit a forfeit"}
        </button>
      </div>

      <ForfeitWizard
        open={open}
        onClose={() => setOpen(false)}
        matchId={matchId}
        side={side}
        ownTeamLabel={ownTeamLabel}
        opponentTeamLabel={opponentTeamLabel}
        opponentCoachEmail={opponentCoachEmail}
      />
    </section>
  );
}
