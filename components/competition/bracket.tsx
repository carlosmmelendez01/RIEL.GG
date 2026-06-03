/**
 * Single-elimination bracket visualization (read-only).
 *
 * Renders rounds as left-to-right columns. Each column uses `justify-around`
 * inside an equal-height flex row, so later rounds fan out and center between
 * the matches that feed them — the classic bracket look without hand-drawn
 * SVG. Winners are highlighted; ungenerated matches show as TBD.
 *
 * Server-renderable (no interactivity) and league-agnostic, so it can be
 * reused on admin, coach, and public surfaces.
 */

import { Crown, Trophy } from "lucide-react";

import type { BracketCell, BracketData, BracketSide } from "@/lib/competition/bracket";
import { cn } from "@/lib/utils";

export function Bracket({ data }: { data: BracketData }) {
  if (!data.seeded || data.rounds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-10 text-center">
        <Trophy className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-semibold">Bracket not seeded yet</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
          Once the regular season finishes, generate the playoffs from the Scheduler and the
          bracket will appear here, seeded from final standings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.championName ? (
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-4 py-3">
          <Crown className="h-5 w-5 text-[color:var(--brand-gold)]" />
          <p className="text-[14px] font-semibold">
            Champion: <span className="text-[color:var(--brand-gold)]">{data.championName}</span>
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-6">
          {data.rounds.map((round) => (
            <div key={round.round} className="flex w-[180px] shrink-0 flex-col">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {round.name}
              </p>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.slots.map((cell, i) => (
                  <MatchCell key={cell?.matchId ?? `tbd-${round.round}-${i}`} cell={cell} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchCell({ cell }: { cell: BracketCell | null }) {
  if (!cell) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-background/30">
        <TbdRow />
        <div className="h-px bg-border/50" />
        <TbdRow />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-card/80",
        cell.finished ? "border-border/70" : "border-border/50",
      )}
    >
      <SideRow side={cell.home} finished={cell.finished} />
      <div className="h-px bg-border/60" />
      <SideRow side={cell.away} finished={cell.finished} />
    </div>
  );
}

function SideRow({ side, finished }: { side: BracketSide | null; finished: boolean }) {
  if (!side) return <TbdRow />;
  const win = side.isWinner;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5",
        win && finished && "bg-[color:var(--brand-gold)]/8",
      )}
    >
      <span
        title={side.name}
        className={cn(
          "flex-1 truncate text-[12px]",
          win ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {side.schoolShort}
      </span>
      {win && finished ? (
        <Crown className="h-3 w-3 shrink-0 text-[color:var(--brand-gold)]" />
      ) : null}
      <span
        className={cn(
          "w-5 shrink-0 text-right font-mono text-[12px] tabular-nums",
          win ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {side.score ?? "–"}
      </span>
    </div>
  );
}

function TbdRow() {
  return (
    <div className="flex items-center px-2.5 py-1.5">
      <span className="text-[12px] italic text-muted-foreground/60">TBD</span>
    </div>
  );
}
