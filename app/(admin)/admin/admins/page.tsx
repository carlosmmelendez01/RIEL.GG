/**
 * League admins / staff.
 *
 * Lets a league owner or admin see who runs the league and invite additional
 * owners, admins, and staff (a league can have many of each). Owners can
 * remove other admins. Mutations live in admin-invite-actions.ts.
 */

import { redirect } from "next/navigation";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { LeagueAdminsManager } from "@/components/admin/league-admins-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import {
  loadLeagueAdmins,
  loadOutstandingLeagueInvites,
} from "@/lib/league-admin/admins-data";

export default async function AdminAdminsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/admins");

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="Admins" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const [admins, invites] = await Promise.all([
    loadLeagueAdmins(ctx.league.id, user.id),
    loadOutstandingLeagueInvites(ctx.league.id),
  ]);

  return (
    <>
      <AdminTopbar
        title="Admins"
        eyebrow={`${ctx.league.name} · ${admins.length} on staff${invites.length > 0 ? ` · ${invites.length} pending` : ""}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <p className="max-w-2xl text-[13px] text-muted-foreground">
          Everyone who helps run {ctx.league.name}. A league can have multiple owners,
          admins, and staff — invite them by email and they&apos;ll claim access when they
          sign in.
        </p>
        <LeagueAdminsManager
          leagueName={ctx.league.name}
          viewerRole={ctx.admin.role}
          admins={admins}
          invites={invites}
        />
      </main>
    </>
  );
}
