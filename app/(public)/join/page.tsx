import { JoinWizard, type JoinLeagueOption } from "@/components/join/join-wizard";
import { prisma } from "@/lib/db/prisma";

export default async function JoinPage() {
  const leagues = await loadJoinLeagues();
  return <JoinWizard leagues={leagues} />;
}

async function loadJoinLeagues(): Promise<JoinLeagueOption[]> {
  const leagues = await prisma.league.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      classification: true,
      primaryColor: true,
      _count: { select: { memberships: true } },
    },
  });

  return leagues.map((league) => ({
    id: league.id,
    slug: league.slug,
    name: league.name,
    shortName: shortNameFor(league.name),
    classification: league.classification,
    primaryColor: league.primaryColor ?? "#A51C30",
    secondaryColor: "#C9A646",
    region: league.description ?? "School esports",
    schoolCount: league._count.memberships,
  }));
}

function shortNameFor(leagueName: string): string {
  const words = leagueName.match(/[A-Za-z0-9]+/g) ?? [];
  const initials = words.slice(0, 4).map((word) => word[0]?.toUpperCase()).join("");
  return initials || leagueName.slice(0, 4).toUpperCase();
}
