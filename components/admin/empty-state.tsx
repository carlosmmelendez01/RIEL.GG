import Link from "next/link";
import {
  ArrowRight,
  Building2,
  HelpCircle,
  ShieldOff,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * League-admin empty states.
 *
 * Rendered any time the admin context is incomplete — user isn't a league
 * admin, their league has no member schools yet, or no competitions have
 * been created. Replaces the previous mock-data fallback that showed every
 * admin a Carmel-themed demo regardless of which league they actually run.
 */

type Kind = "no-admin" | "no-schools" | "no-competitions" | "no-matches" | "no-disputes" | "no-activity";

const COPY: Record<
  Kind,
  {
    eyebrow: string;
    title: string;
    body: string;
    primary?: { label: string; href: string };
    secondary?: { label: string; href: string };
  }
> = {
  "no-admin": {
    eyebrow: "Restricted",
    title: "You don't have league admin access.",
    body: "Only league owners, admins, and staff can view this dashboard. If you think this is wrong, ask your league owner to add you as an admin.",
    primary: { label: "Back to home", href: "/me" },
    secondary: { label: "Get help", href: "mailto:support@riel.gg" },
  },
  "no-schools": {
    eyebrow: "Open registration",
    title: "No member schools yet.",
    body: "Once schools apply and you approve them, they'll appear here and start showing up in competitions, standings, and analytics.",
    primary: { label: "Invite a school", href: "/admin/schools" },
    secondary: { label: "Get help", href: "mailto:support@riel.gg" },
  },
  "no-competitions": {
    eyebrow: "Almost there",
    title: "Create your first competition.",
    body: "You've got schools registered — now spin up a season-play league, a tournament, or a scrim cup so teams can compete.",
    primary: { label: "Create a competition", href: "/admin/competitions/new" },
    secondary: { label: "Get help", href: "mailto:support@riel.gg" },
  },
  "no-matches": {
    eyebrow: "Nothing scheduled",
    title: "No matches in this window.",
    body: "Once the AI scheduler runs or you publish a manual schedule, matches will appear here.",
    primary: { label: "Run the scheduler", href: "/admin/scheduler" },
  },
  "no-disputes": {
    eyebrow: "Clean week",
    title: "No open disputes.",
    body: "Coaches haven't raised any unresolved score or eligibility issues. We'll surface anything new here as soon as it's reported.",
  },
  "no-activity": {
    eyebrow: "Quiet for now",
    title: "No recent league activity.",
    body: "Match results, school approvals, schedule updates, and admin actions will appear here as they happen.",
  },
};

export function LeagueAdminEmptyState({
  kind,
  leagueName,
  className,
}: {
  kind: Kind;
  leagueName?: string | null;
  className?: string;
}) {
  const copy = COPY[kind];
  const Icon =
    kind === "no-admin"
      ? ShieldOff
      : kind === "no-schools"
        ? Building2
        : kind === "no-competitions"
          ? Trophy
          : kind === "no-matches"
            ? Sparkles
            : kind === "no-disputes"
              ? Sparkles
              : Sparkles;

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
          {leagueName && (kind === "no-schools" || kind === "no-competitions")
            ? `${leagueName} — ${copy.title.toLowerCase()}`
            : copy.title}
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
