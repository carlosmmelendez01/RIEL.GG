/**
 * Real-data games carousel. Pulls every active GameTitle from the DB.
 * Each card gets a brief-supplied accent gradient so the row reads as a
 * vibrant catalog instead of a list.
 */

import Link from "next/link";
import { ArrowRight, Gamepad2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

// Per-game accent — keyed by GameTitle.slug. Falls back to crimson.
const GAME_ACCENT: Record<string, { gradient: string; tag: string }> = {
  val: {
    gradient: "from-[#ff4655]/60 via-[#0f1923]/30 to-background",
    tag: "Tactical FPS",
  },
  lol: {
    gradient: "from-[#0a4baf]/60 via-[#01112c]/30 to-background",
    tag: "MOBA",
  },
  rl: {
    gradient: "from-[#1f8ef1]/60 via-[#1a1a40]/30 to-background",
    tag: "Vehicular Sport",
  },
  smash: {
    gradient: "from-[#facc15]/40 via-[#dc2626]/30 to-background",
    tag: "Platform Fighter",
  },
  ow2: {
    gradient: "from-[#f99e1a]/50 via-[#43484c]/30 to-background",
    tag: "Hero Shooter",
  },
};

export async function GamesSupported() {
  const games = await prisma.gameTitle.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      publisher: true,
      _count: { select: { competitions: true, teams: true } },
    },
  });

  return (
    <section className="relative border-t border-border/60 py-24" id="games">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-gold)]">
            Games we support
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            The titles students actually play
          </h2>
          <div
            aria-hidden
            className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-[color:var(--brand-gold)]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {games.map((g) => {
            const accent = GAME_ACCENT[g.slug] ?? {
              gradient: "from-[color:var(--brand-crimson)]/40 via-card/40 to-background",
              tag: "Esports",
            };
            return (
              <Link
                key={g.slug}
                href={`/games/${g.slug}`}
                className="group block focus:outline-none"
              >
                <Card className="relative aspect-[4/5] overflow-hidden border-border/60 bg-card/60 transition-transform group-hover:-translate-y-0.5">
                  {/* Gradient backdrop */}
                  <div
                    aria-hidden
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-100",
                      accent.gradient,
                    )}
                  />
                  {/* Grid texture */}
                  <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-30" />
                  {/* Subtle vignette */}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent"
                  />

                  {/* Content */}
                  <div className="relative flex h-full flex-col justify-between p-5">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
                        <Gamepad2 className="h-3 w-3" />
                        {accent.tag}
                      </span>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold leading-tight text-white drop-shadow-md">
                        {g.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/70 drop-shadow">
                        {g.publisher ?? "—"}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-white/80">
                        <span>
                          <span className="font-mono tabular-nums">{g._count.competitions}</span>{" "}
                          comp{g._count.competitions === 1 ? "" : "s"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                        <span>
                          <span className="font-mono tabular-nums">{g._count.teams}</span>{" "}
                          team{g._count.teams === 1 ? "" : "s"}
                        </span>
                      </div>

                      {/* View Game footer */}
                      <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 transition-colors group-hover:text-white">
                        View Game
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
