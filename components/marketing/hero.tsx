import Link from "next/link";
import { ArrowRight, Radio, Star, Trophy, Zap } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { MatchStateMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function Hero({
  liveMatchCount,
  gamesCount,
  schoolCount,
}: {
  liveMatchCount: number;
  gamesCount: number;
  schoolCount: number;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Faint grid + crimson/purple glow background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-grid-faint [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/4 top-[-25%] h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
        style={{
          background: "radial-gradient(closest-side, var(--brand-crimson) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-[10%] h-[500px] w-[700px] rounded-full opacity-30 blur-[140px]"
        style={{
          background: "radial-gradient(closest-side, var(--brand-purple) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-28 md:pt-28 md:pb-36">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          {/* Headline column */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              <Zap className="h-3 w-3 text-[color:var(--brand-gold)]" />
              Built for scholastic esports
            </div>

            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
              <span className="text-foreground">The home of</span>
              <br />
              <span className="text-gradient-brand">scholastic esports.</span>
            </h1>

            <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground md:text-xl">
              RIEL.GG connects high schools, players, and communities through competitive esports
              leagues that build skills, sportsmanship, and opportunity.
            </p>

            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row">
              <Link
                href="/join"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson",
                )}
              >
                Join a League
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="#leagues" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Explore Leagues
              </Link>
            </div>

            {/* Trust strip — avatar group + 5-star + school count */}
            <TrustStrip schoolCount={schoolCount} />
          </div>

          {/* Visual / Live match card column */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <ArenaVisual />
            <LiveMatchFloatingCard liveMatchCount={liveMatchCount} gamesCount={gamesCount} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Abstract arena visual — layered gradient blocks suggesting an esports arena.
 * Pure CSS so it scales and respects the brand without needing real photography.
 */
function ArenaVisual() {
  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-[color:var(--brand-crimson)]/30 via-[color:var(--brand-purple)]/20 to-background shadow-[0_30px_120px_-20px_oklch(0.4555_0.1734_19.27/40%)]">
      {/* Grid texture */}
      <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-50" />

      {/* Stage / horizon lines */}
      <div
        aria-hidden
        className="absolute inset-x-8 top-[58%] h-px bg-gradient-to-r from-transparent via-[color:var(--brand-crimson)]/60 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-12 top-[64%] h-px bg-gradient-to-r from-transparent via-[color:var(--brand-purple)]/40 to-transparent"
      />

      {/* PC silhouettes (3 rectangles on the stage) */}
      <div className="absolute inset-x-0 bottom-[24%] flex items-end justify-center gap-6 px-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "rounded-md border border-border/80 bg-background/80 backdrop-blur",
                i === 1 ? "h-20 w-28" : "h-16 w-24",
              )}
            >
              <div
                className={cn(
                  "h-full w-full rounded-md",
                  "bg-gradient-to-br from-[color:var(--brand-crimson)]/30 via-transparent to-[color:var(--brand-purple)]/20",
                )}
              />
            </div>
            <div className="h-2 w-10 rounded-sm bg-muted-foreground/30" />
            <div
              className={cn(
                "rounded-sm",
                i === 1 ? "h-1.5 w-14 bg-[color:var(--brand-crimson)]/70" : "h-1 w-10 bg-muted-foreground/30",
              )}
            />
          </div>
        ))}
      </div>

      {/* Crowd dots */}
      <div className="absolute inset-x-0 bottom-[10%] flex items-center justify-center gap-1.5 opacity-60">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="block h-1 w-1 rounded-full bg-muted-foreground/60"
            style={{ opacity: 0.3 + ((i * 73) % 60) / 100 }}
          />
        ))}
      </div>

      {/* Top corner: tournament flag */}
      <div className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)] backdrop-blur">
        <Trophy className="h-3 w-3" />
        Spring 2026 Playoffs
      </div>
    </div>
  );
}

function TrustStrip({ schoolCount }: { schoolCount: number }) {
  // Synthetic avatar dots — small initial circles in varied brand tones so the
  // strip reads as a face-pile without needing real photos.
  const AVATARS: Array<{ initials: string; tone: string }> = [
    { initials: "JH", tone: "from-[color:var(--brand-crimson)] to-rose-700" },
    { initials: "MW", tone: "from-[color:var(--brand-purple)] to-fuchsia-700" },
    { initials: "AP", tone: "from-[color:var(--brand-gold)] to-amber-600" },
    { initials: "CM", tone: "from-emerald-500 to-emerald-700" },
    { initials: "SH", tone: "from-sky-500 to-blue-700" },
  ];

  return (
    <div className="mt-10 flex flex-wrap items-center gap-4">
      <div className="flex items-center -space-x-2">
        {AVATARS.map((a) => (
          <div
            key={a.initials}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br text-[10px] font-semibold tracking-tight text-white",
              a.tone,
            )}
          >
            {a.initials}
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className="h-3.5 w-3.5 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]"
            />
          ))}
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Trusted by{" "}
          <span className="font-semibold text-foreground">{schoolCount}+ schools</span> across the
          country
        </p>
      </div>
    </div>
  );
}

function LiveMatchFloatingCard({
  liveMatchCount,
  gamesCount,
}: {
  liveMatchCount: number;
  gamesCount: number;
}) {
  const hasLive = liveMatchCount > 0;
  return (
    <div className="absolute -bottom-6 -left-2 w-[280px] rounded-2xl border border-border/80 bg-card/95 p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:-left-6 lg:-bottom-10 lg:left-[-3rem]">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-70",
              hasLive ? "animate-ping bg-[color:var(--brand-crimson)]" : "bg-muted-foreground/40",
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              hasLive ? "bg-[color:var(--brand-crimson)]" : "bg-muted-foreground/60",
            )}
          />
        </span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.16em]",
            hasLive ? "text-[color:var(--brand-crimson)]" : "text-muted-foreground",
          )}
        >
          {hasLive ? "Live now" : "Standing by"}
        </span>
        <Radio className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <p className="mt-3 text-[14px] font-semibold leading-snug text-foreground">
        RIEL Varsity League Playoffs — Week 2
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {hasLive
          ? `${liveMatchCount} match${liveMatchCount === 1 ? "" : "es"} live across ${gamesCount} games`
          : `${gamesCount} games scheduled this week`}
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
        <MatchStateMark state={hasLive ? "in-progress" : "standby"} size={16} />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {hasLive ? "Brebeuf vs Carmel · Game 3" : "Next match opens soon"}
        </span>
      </div>
    </div>
  );
}
