/**
 * League schools directory.
 *
 * Lists every school in the admin's league with real team / player / coach
 * counts derived from `LeagueMembership` joined down through `Team → Roster
 * → RosterMembership`. The previous mock view showed every league admin
 * the same 11 demo schools regardless of which league they actually run.
 *
 * The Approval queue surfaces real pending `SchoolApplication` rows; admins
 * can approve (creates School + LeagueMembership + owner SchoolMembership)
 * or reject (with a reason that lands in the audit log) right from here.
 */

import { redirect } from "next/navigation";
import { Building2, CircleAlert, GraduationCap, Mail, ShieldCheck, Users } from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { LeagueAdminEmptyState } from "@/components/admin/empty-state";
import { InviteSchoolDialog } from "@/components/admin/invite-school-dialog";
import { ManageSchoolDivisionsDialog } from "@/components/admin/manage-school-divisions-dialog";
import { PendingApplicationsCard } from "@/components/admin/pending-applications-card";
import { SchoolClassificationOverride } from "@/components/admin/school-classification-override";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadLeagueSchoolDirectory,
  loadPendingApplications,
  requireLeagueAdmin,
  type LeagueSchoolRow,
} from "@/lib/league-admin/dashboard";
import type { DivisionOption } from "@/lib/classification/season-service";

export default async function AdminSchoolsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/schools");

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return (
      <>
        <AdminTopbar title="Schools" eyebrow="Admin view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <LeagueAdminEmptyState kind="no-admin" />
        </main>
      </>
    );
  }

  const [directory, pending] = await Promise.all([
    loadLeagueSchoolDirectory(ctx.league.id),
    loadPendingApplications(ctx.league.id),
  ]);
  const { schools, divisions } = directory;

  return (
    <>
      <AdminTopbar
        title="Schools"
        eyebrow={`${ctx.league.name} · ${schools.length} member school${schools.length === 1 ? "" : "s"}${pending.length > 0 ? ` · ${pending.length} pending` : ""}`}
      />

      <main className="flex-1 space-y-8 px-6 py-6 md:px-8">
        <PendingApplicationsCard applications={pending} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                School directory
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Invite a school directly, or schools can apply at{" "}
                <span className="font-mono">/join</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ManageSchoolDivisionsDialog
                leagueName={ctx.league.name}
                options={divisions}
              />
              {schools.length > 0 ? (
                <InviteSchoolDialog
                  leagueName={ctx.league.name}
                />
              ) : null}
            </div>
          </div>

          {schools.length === 0 ? (
            <LeagueAdminEmptyState
              kind="no-schools"
              leagueName={ctx.league.name}
              actionSlot={
                <div className="flex flex-wrap justify-center gap-2">
                  <ManageSchoolDivisionsDialog
                    leagueName={ctx.league.name}
                    options={divisions}
                  />
                  <InviteSchoolDialog leagueName={ctx.league.name} />
                </div>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {schools.map((s) => (
                <SchoolCard
                  key={s.schoolId}
                  school={s}
                  divisions={divisions}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

// --- Subcomponents -----------------------------------------------------

function SchoolCard({
  school,
  divisions,
}: {
  school: LeagueSchoolRow;
  divisions: DivisionOption[];
}) {
  const monogram = (school.shortName ?? school.name)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div className="group block">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[12px] font-bold tracking-tight text-white">
              {monogram}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-[15px] font-semibold leading-tight">
                {school.shortName ?? school.name}
              </CardTitle>
              <p className="truncate text-[11px] text-muted-foreground">
                {school.shortName ? school.name : ""}
                {school.city ? `${school.shortName ? " · " : ""}${school.city}, ${school.state ?? ""}` : ""}
              </p>
              <SchoolClassificationOverride
                schoolId={school.schoolId}
                schoolName={school.name}
                classification={school.classification}
                divisions={divisions}
              />
            </div>
            {school.ncesId ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-500">
                <GraduationCap className="h-2.5 w-2.5" />
                NCES
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border/60 bg-background/40 p-3 text-center">
            <Stat icon={Building2} label="Teams" value={school.teamCount} />
            <Stat icon={Users} label="Players" value={school.playerCount} />
            <Stat icon={Mail} label="Coaches" value={school.coachCount} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              Joined{" "}
              {school.joinedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <ComplianceBadge school={school} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceBadge({ school }: { school: LeagueSchoolRow }) {
  if (school.agreementAccepted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-500">
        <ShieldCheck className="h-2.5 w-2.5" />
        {coverageLabel(school.agreementCoverageSource)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
      <CircleAlert className="h-2.5 w-2.5" />
      Agreement pending
    </span>
  );
}

function coverageLabel(source: string | null) {
  switch (source) {
    case "LEAGUE_MASTER_AGREEMENT":
      return "Master agreement";
    case "PARENT_GUARDIAN_REQUIRED":
      return "Parent consent";
    case "DIRECT_SCHOOL_AUTHORIZATION":
      return "School authorized";
    default:
      return "Agreement";
  }
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <div>
      <Icon className="mx-auto h-3 w-3 text-muted-foreground" />
      <p className="mt-1 font-mono text-[16px] font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
