import { notFound, redirect } from "next/navigation";

import { loadLatestPublicSeason } from "@/lib/public/league";

/**
 * Convenience redirect — `/league/[slug]/results` always lands on the
 * most recent season's page so coaches can bookmark a stable URL.
 */
export default async function LeagueResultsRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const latest = await loadLatestPublicSeason(slug);
  if (!latest) notFound();
  redirect(`/league/${latest.leagueSlug}/season/${latest.seasonId}`);
}
