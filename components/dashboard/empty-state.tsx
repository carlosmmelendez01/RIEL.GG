import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  GraduationCap,
  HelpCircle,
  Trophy,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Coach-side empty state.
 *
 * Rendered any time a coach's school context has no real registered teams
 * or competitions. Replaces the previous behavior of falling back to
 * hardcoded Carmel/Fishers mock data — schools that haven't registered
 * yet now see honest onboarding guidance instead.
 */

type Kind = "no-school" | "no-teams" | "no-matches" | "no-standings";

const COPY: Record<
  Kind,
  { eyebrow: string; title: string; body: string; primary?: { label: string; href: string }; secondary?: { label: string; href: string } }
> = {
  "no-school": {
    eyebrow: "Welcome to RIEL.GG",
    title: "You're not linked to a school yet.",
    body: "Once your school is approved by your league office, you'll see your teams, matches, and standings here.",
    primary: { label: "Apply your school", href: "/join" },
    secondary: { label: "Get help", href: "mailto:support@riel.gg" },
  },
  "no-teams": {
    eyebrow: "Almost there",
    title: "You haven't registered your teams for any competitions yet.",
    body: "Add your roster, pick a game and skill tier, and you'll appear in the league standings the moment registration closes.",
    primary: { label: "Register a team", href: "/admin/competitions" },
    secondary: { label: "Need help?", href: "mailto:support@riel.gg" },
  },
  "no-matches": {
    eyebrow: "Nothing on the schedule",
    title: "No upcoming matches.",
    body: "Once the league publishes the schedule for your competition, your matches will appear here. The AI scheduler typically runs weekly on Sundays.",
    primary: { label: "View competitions", href: "/admin/competitions" },
  },
  "no-standings": {
    eyebrow: "Standings",
    title: "No results yet this season.",
    body: "Standings populate as your team plays matches. Win your first match and your rank lands here automatically.",
  },
};

export function DashboardEmptyState({
  kind,
  schoolName,
  className,
}: {
  kind: Kind;
  /** Optional — when known, personalize the title with the school name. */
  schoolName?: string | null;
  className?: string;
}) {
  const copy = COPY[kind];
  const Icon = kind === "no-school" ? GraduationCap : kind === "no-teams" ? Users : kind === "no-matches" ? CalendarPlus : Trophy;

  return (
    <Card
      className={cn(
        "border-dashed border-border/80 bg-card/40 text-center",
        className,
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 md:py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {copy.eyebrow}
        </p>
        <h3 className="max-w-md text-balance text-xl font-semibold tracking-tight md:text-2xl">
          {schoolName ? `${schoolName} — ${copy.title.toLowerCase()}` : copy.title}
        </h3>
        <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
          {copy.body}
        </p>
        {(copy.primary || copy.secondary) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {copy.primary ? (
              <Link
                href={copy.primary.href}
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
              >
                {copy.primary.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            {copy.secondary ? (
              <Link
                href={copy.secondary.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-[13px] font-medium hover:bg-card"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {copy.secondary.label}
              </Link>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
