/**
 * League resources admin.
 *
 * League-specific rules, match-day guides, and lobby setup notes. These are
 * evergreen resources, unlike announcements, and can be scoped to a game,
 * season, or competition when needed.
 */

import { redirect } from "next/navigation";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { ResourceManager } from "@/components/league/resource-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import { loadLeagueResourceManager } from "@/lib/league/resources";

export const metadata = {
  title: "Resources · Admin · RIEL.GG",
};

export default async function AdminResourcesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/resources");

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="Resources" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const data = await loadLeagueResourceManager(ctx.league.id);

  return (
    <>
      <AdminTopbar
        title="Rules & resources"
        eyebrow={`${ctx.league.name} · ${data.resources.length} published or draft item${data.resources.length === 1 ? "" : "s"}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-crimson)]">
            League-specific
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Publish the rulebook where coaches will actually look
          </h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            Add league handbooks, game rules, lobby setup, match-day instructions,
            eligibility notes, and compliance reminders. Public resources show on the league page;
            coach-only resources stay inside signed-in coach dashboards.
          </p>
        </section>

        <ResourceManager leagueId={ctx.league.id} data={data} />
      </main>
    </>
  );
}
