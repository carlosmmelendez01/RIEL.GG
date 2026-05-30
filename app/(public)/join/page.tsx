/**
 * Public application landing.
 *
 * Server component — fetches every league that accepts public applications,
 * shapes them for the wizard, and hands off to the client component that
 * runs the three-step flow.
 *
 * "Accepts public applications" today means simply: every League row in the
 * DB. We'll add an `acceptingApplications` toggle on League later if a
 * league needs to pause inflow without going offline.
 */

import { prisma } from "@/lib/db/prisma";
import { JoinWizard, type JoinLeagueOption } from "@/components/join/join-wizard";

export const revalidate = 60; // refresh league list every minute

const REGION_BY_SLUG: Record<string, string> = {
  // Curated for the leagues we know — others fall back to "Multi-state".
  riel: "National",
  hea: "Indiana",
};

export default async function JoinPage() {
  const rows = await prisma.league.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      classification: true,
      primaryColor: true,
      _count: { select: { memberships: true } },
    },
  });

  const leagues: JoinLeagueOption[] = rows.map((l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    shortName: shortNameFor(l.name),
    classification: l.classification,
    primaryColor: l.primaryColor ?? "#A31F34",
    secondaryColor: deriveSecondary(l.primaryColor ?? "#A31F34"),
    region: REGION_BY_SLUG[l.slug] ?? "Multi-state",
    schoolCount: l._count.memberships,
  }));

  return <JoinWizard leagues={leagues} />;
}

// --- Helpers -----------------------------------------------------------

function shortNameFor(name: string): string {
  // First letters of each significant word, max 5 chars.
  const stop = new Set(["the", "of", "and", "&", "for"]);
  const initials = name
    .split(/\s+/)
    .filter((w) => !stop.has(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return initials.slice(0, 5) || name.slice(0, 4).toUpperCase();
}

function deriveSecondary(primary: string): string {
  // Crude lightening — picks a complementary gold-ish tone when primary is
  // crimson-ish, otherwise mirrors primary. Good enough for the gradient
  // chip; designers can override per-league when the schema gains a color.
  return /a3|c0|b0|d0/i.test(primary) ? "#FFCC00" : primary;
}
