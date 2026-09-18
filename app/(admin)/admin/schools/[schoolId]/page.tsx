import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CircleAlert,
  GraduationCap,
  Mail,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";

import { SchoolTeamRegistration } from "@/components/admin/school-team-registration";
import { AdminTopbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, type Actor } from "@/lib/domain/permissions";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import { loadLeagueSchoolDetail } from "@/lib/league-admin/school-detail";

export default async function AdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/admin/schools/${schoolId}`);

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return <OutOfScope leagueName="League admin" />;
  }

  const detail = await loadLeagueSchoolDetail(ctx.league.id, schoolId);
  if (!detail) {
    return <OutOfScope leagueName={ctx.league.name} />;
  }

  const actor: Actor = {
    userId: user.id,
    leagueRoles:
      ctx.admin.role === "STAFF"
        ? []
        : [{ leagueId: ctx.league.id, role: ctx.admin.role }],
    schoolRoles: [],
  };
  const canRegisterForSchool = can(
    actor,
    "registration.registerForSchool",
    { leagueId: ctx.league.id },
  );
  const location = [detail.school.city, detail.school.state].filter(Boolean).join(", ");

  return (
    <>
      <AdminTopbar
        title={detail.school.shortName ?? detail.school.name}
        eyebrow={`${ctx.league.name} · School operations`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <Link
          href="/admin/schools"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All schools
        </Link>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex flex-wrap items-start gap-4 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-sm font-bold tracking-tight text-white">
                {monogram(detail.school.shortName ?? detail.school.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight">{detail.school.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {location}
                    </span>
                  ) : null}
                  {detail.school.ncesId ? (
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      NCES {detail.school.ncesId}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Joined {detail.joinedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StateBadge active={detail.membershipStatus === "ACTIVE"}>
                    {detail.membershipStatus.toLowerCase()} member
                  </StateBadge>
                  <StateBadge active={detail.agreementAccepted}>
                    {detail.agreementAccepted ? "Agreement accepted" : "Agreement pending"}
                  </StateBadge>
                  {detail.school.level ? (
                    <span className="rounded-sm border border-border/60 bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {detail.school.level.toLowerCase()} school
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3 text-center">
                <p className="font-mono text-2xl font-bold tabular-nums">{detail.teams.length}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  teams
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                School staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.staff.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No active coach or manager found.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.staff.map((staff) => (
                    <li key={staff.id} className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-semibold">{staff.name}</p>
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {staff.isOwner ? "Owner" : staff.role.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground">
                        <Mail className="h-2.5 w-2.5 shrink-0" />
                        {staff.email}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Teams and registrations
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Review each team&apos;s league registrations. Owners and admins can register an
              eligible team for the school; roster membership stays with the coaches.
            </p>
          </div>

          {detail.teams.length === 0 ? (
            <Card className="border-dashed border-border/70 bg-card/40">
              <CardContent className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
                <p className="text-[14px] font-semibold">No teams yet</p>
                <p className="max-w-md text-[12px] text-muted-foreground">
                  A school coach or manager still creates the team. Once it exists, league
                  admins can help place it into an eligible competition here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {detail.teams.map((team) => (
                <SchoolTeamRegistration
                  key={team.id}
                  team={team}
                  canRegisterForSchool={canRegisterForSchool}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function OutOfScope({ leagueName }: { leagueName: string }) {
  return (
    <>
      <AdminTopbar title="School not found" eyebrow={leagueName} />
      <main className="flex-1 px-6 py-12 md:px-8">
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <CircleAlert className="h-7 w-7 text-muted-foreground" />
            <h1 className="text-xl font-semibold">This school isn&apos;t in your league.</h1>
            <Link
              href="/admin/schools"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[color:var(--brand-crimson-deep)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to schools
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function StateBadge({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]"
      }`}
    >
      {active ? <ShieldCheck className="h-2.5 w-2.5" /> : <CircleAlert className="h-2.5 w-2.5" />}
      {children}
    </span>
  );
}

function monogram(value: string) {
  return value.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
