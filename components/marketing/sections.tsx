/**
 * Stateless marketing-page sections — all hardcoded copy / config. Section
 * components that need real DB reads (FeaturedLeagues, GamesSupported) live
 * in their own files.
 */

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  LineChart,
  MessageSquare,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- StatsStrip ---------------------------------------------------------

export function StatsStrip({
  schoolCount,
  playerCount,
  gameCount,
  matchCount,
  leagueCount,
}: {
  schoolCount: number;
  playerCount: number;
  gameCount: number;
  matchCount: number;
  leagueCount: number;
}) {
  // Format with thousands separator + a "+" so the marketing message
  // reads as growth-oriented instead of a precise count.
  const fmt = (n: number) => `${n.toLocaleString()}+`;

  const stats: Array<{ label: string; value: string; icon: LucideIcon; tone: string }> = [
    { label: "Schools", value: fmt(schoolCount), icon: Building2, tone: "crimson" },
    { label: "Players", value: fmt(playerCount), icon: Users, tone: "purple" },
    { label: "Games", value: String(gameCount), icon: Gamepad2, tone: "gold" },
    { label: "Matches Played", value: fmt(matchCount), icon: Trophy, tone: "emerald" },
    { label: "Leagues", value: fmt(leagueCount), icon: TrendingUp, tone: "crimson" },
  ];

  return (
    <section className="border-y border-border/60 bg-card/30 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                  TONE_TILE[s.tone],
                )}
              >
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
                  {s.value}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- HowItWorks ---------------------------------------------------------

const HOW_ITEMS: Array<{ step: string; title: string; body: string; icon: LucideIcon; tone: string }> = [
  {
    step: "1",
    title: "Join",
    body: "Schools and players join a league that fits.",
    icon: UserPlus,
    tone: "crimson",
  },
  {
    step: "2",
    title: "Compete",
    body: "Play in structured seasons and tournaments.",
    icon: CalendarDays,
    tone: "gold",
  },
  {
    step: "3",
    title: "Track",
    body: "Stats, insights, and performance tracking.",
    icon: LineChart,
    tone: "purple",
  },
  {
    step: "4",
    title: "Grow",
    body: "Build skills, earn recognition, and create opportunities.",
    icon: Sparkles,
    tone: "emerald",
  },
];

const TONE_TILE: Record<string, string> = {
  crimson:
    "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  purple:
    "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
};

const TONE_RING: Record<string, string> = {
  crimson: "ring-1 ring-[color:var(--brand-crimson)]/15",
  gold: "ring-1 ring-[color:var(--brand-gold)]/15",
  purple: "ring-1 ring-[color:var(--brand-purple)]/15",
  emerald: "ring-1 ring-emerald-500/15",
};

export function HowItWorks() {
  return (
    <section className="relative border-t border-border/60 py-24" id="how-it-works">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
            How it works
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            How RIEL.GG works
          </h2>
          <div
            aria-hidden
            className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-[color:var(--brand-crimson)]"
          />
        </div>

        <div className="grid items-stretch gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:gap-0">
          {HOW_ITEMS.map((item, i) => (
            <HowItWorksRow key={item.step} item={item} index={i} total={HOW_ITEMS.length} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksRow({
  item,
  index,
  total,
}: {
  item: (typeof HOW_ITEMS)[number];
  index: number;
  total: number;
}) {
  const showArrow = index < total - 1;
  return (
    <>
      <Card
        className={cn(
          "hover-edge-crimson group relative overflow-hidden border-border/60 bg-card/80 p-6 transition-colors hover:bg-card lg:rounded-2xl",
          TONE_RING[item.tone],
        )}
      >
        <div className="flex items-start justify-between">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold tabular-nums",
              TONE_TILE[item.tone],
            )}
          >
            {item.step}
          </span>
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border",
              TONE_TILE[item.tone],
            )}
          >
            <item.icon className="h-4 w-4" />
          </div>
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-tight">{item.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
      </Card>
      {showArrow ? (
        <div
          aria-hidden
          className="hidden items-center justify-center px-2 text-muted-foreground/40 lg:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </div>
      ) : null}
    </>
  );
}

// --- WhySchools ---------------------------------------------------------

const WHY_ITEMS: Array<{ title: string; body: string; icon: LucideIcon; tone: string }> = [
  {
    title: "Safe & Fair Play",
    body: "Eligibility checks, sportsmanship guardrails, and admin oversight.",
    icon: ShieldCheck,
    tone: "crimson",
  },
  {
    title: "Easy to Manage",
    body: "Powerful tools that match how schools actually operate.",
    icon: BadgeCheck,
    tone: "gold",
  },
  {
    title: "Built for Students",
    body: "Profiles, stats, and goals that students keep coming back to.",
    icon: Users,
    tone: "purple",
  },
  {
    title: "Pathway to Opportunity",
    body: "From varsity to college recruiting to scholarships.",
    icon: GraduationCap,
    tone: "emerald",
  },
  {
    title: "We've Got Your Back",
    body: "Real humans helping you succeed — onboarding, training, support.",
    icon: HeartHandshake,
    tone: "crimson",
  },
];

export function WhySchools() {
  return (
    <section
      className="relative border-t border-border/60 bg-gradient-to-b from-background via-card/20 to-background py-20"
      id="schools"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-purple)]">
            Why schools love RIEL.GG
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Built by educators, for educators
          </h2>
          <div
            aria-hidden
            className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-[color:var(--brand-purple)]"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
          {WHY_ITEMS.map((item) => (
            <div key={item.title} className="text-center">
              <div
                className={cn(
                  "mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2",
                  TONE_TILE[item.tone],
                )}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[14px] font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Testimonials -------------------------------------------------------

const TESTIMONIALS: Array<{
  quote: string;
  name: string;
  role: string;
  initials: string;
  tone: string;
}> = [
  {
    quote:
      "RIEL.GG turned a season's worth of spreadsheets into thirty minutes of setup. We onboarded forty-one schools in our first month.",
    name: "Jamie Holcomb",
    role: "Hoosier Esports Alliance",
    initials: "JH",
    tone: "crimson",
  },
  {
    quote:
      "Our coaches can finally focus on coaching. The match flow, the dispute tooling, the analytics — it's the platform we wished existed.",
    name: "Marcus Weaver",
    role: "Esports Ohio",
    initials: "MW",
    tone: "purple",
  },
  {
    quote:
      "Every player has a real profile they care about. We've seen retention shoot up because students actually want to log back in.",
    name: "Dr. Anika Patel",
    role: "Michigan Collegiate Esports",
    initials: "AP",
    tone: "gold",
  },
];

export function Testimonials() {
  return (
    <section className="relative border-t border-border/60 py-24" id="about">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-gold)]">
            What people are saying
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Trusted by directors who don&apos;t accept &ldquo;good enough.&rdquo;
          </h2>
          <div
            aria-hidden
            className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-[color:var(--brand-gold)]"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card
              key={t.name}
              className="hover-edge-crimson border-border/60 bg-card/80 p-6 transition-colors hover:bg-card"
            >
              <CardContent className="p-0">
                <Quote
                  className={cn(
                    "h-6 w-6",
                    t.tone === "crimson" && "text-[color:var(--brand-crimson)]/60",
                    t.tone === "purple" && "text-[color:var(--brand-purple)]/60",
                    t.tone === "gold" && "text-[color:var(--brand-gold)]/60",
                  )}
                />
                <p className="mt-4 text-[14px] leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Star rating */}
                <div className="mt-5 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]"
                    />
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 text-[13px] font-semibold tracking-tight",
                      TONE_TILE[t.tone],
                    )}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold tracking-tight">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- FinalCta ----------------------------------------------------------

export function FinalCta() {
  return (
    <section className="relative border-t border-border/60 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-[color:var(--brand-crimson)]/30 bg-gradient-to-br from-[color:var(--brand-crimson)]/12 via-card/85 to-[color:var(--brand-purple)]/10 p-8 md:p-12">
          {/* Glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-0 h-[300px] w-[600px] rounded-full opacity-40 blur-[120px]"
            style={{
              background:
                "radial-gradient(closest-side, var(--brand-crimson) 0%, transparent 70%)",
            }}
          />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2 text-[color:var(--brand-crimson)]">
                <MessageSquare className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                  Ready when you are
                </span>
              </div>
              <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-4xl">
                Ready to level up your program?
              </h2>
              <p className="mt-2 max-w-xl text-balance text-[14px] text-muted-foreground md:text-base">
                Join hundreds of schools competing on RIEL.GG. Onboarding is free and takes about 30
                minutes.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
              <Link
                href="mailto:hello@riel.gg"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
