/**
 * Coach resources.
 *
 * Shows published resources from every active league the coach's school
 * participates in. Coach-only resources are included here; public pages only
 * show resources marked for everyone.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { Topbar } from "@/components/dashboard/topbar";
import { ResourceList } from "@/components/league/resource-list";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadCoachResources } from "@/lib/league/resources";

export const metadata = {
  title: "Resources · ArcLight",
};

export default async function DashboardResourcesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/resources");

  const data = await loadCoachResources(user.id);
  if (!data) {
    return (
      <>
        <Topbar title="Resources" eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-school" />
        </main>
      </>
    );
  }

  const total = data.leagues.reduce((sum, league) => sum + league.resources.length, 0);

  return (
    <>
      <Topbar
        title="Rules & resources"
        eyebrow={`${data.schoolName} · ${total} resource${total === 1 ? "" : "s"}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-crimson)]">
            League handbooks
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Rules, lobby setup, and match-day notes
          </h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            League admins publish their own rulesets here. Check this page before match day
            for title-specific rules, check-in expectations, lobby setup, and eligibility notes.
          </p>
        </section>

        {data.leagues.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-card/40">
            <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <h2 className="text-lg font-semibold tracking-tight">No active league resources</h2>
              <p className="max-w-md text-[13px] text-muted-foreground">
                Your school is not active in a league with published resources yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {data.leagues.map((league) => (
              <section key={league.leagueId} className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-purple)]">
                      {league.resources.length} item{league.resources.length === 1 ? "" : "s"}
                    </p>
                    <h2 className="text-xl font-semibold tracking-tight">{league.leagueName}</h2>
                  </div>
                  <Link
                    href={`/league/${league.leagueSlug}/resources`}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Public resources
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <ResourceList
                  resources={league.resources}
                  showAudience
                  emptyBody="This league has not published coach-facing resources yet."
                />
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
