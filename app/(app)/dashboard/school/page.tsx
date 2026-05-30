/**
 * Coach school directory.
 *
 * Shows the people (SchoolMemberships) at the viewer's school + a list of
 * outstanding invites with copy/revoke controls. Single-school coaches see
 * their school directly; multi-school coaches use the first one for now —
 * a switcher lands when we generalize the multi-school UX.
 *
 * Player-tier users (no MANAGER/COACH membership anywhere) get bounced
 * back to /dashboard with the standard empty state.
 */

import { redirect } from "next/navigation";
import { Crown, Mail, MapPin, ShieldCheck, Users } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { SchoolInviteManager } from "@/components/school/school-invite-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  loadCoachSchoolPage,
  resolveActiveSchool,
  type SchoolMember,
} from "@/lib/school/data";
import { cn } from "@/lib/utils";

export default async function DashboardSchoolPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/school");

  const active = await resolveActiveSchool(user.id);
  if (!active) {
    return (
      <>
        <Topbar title="School" eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-school" />
        </main>
      </>
    );
  }

  const data = await loadCoachSchoolPage(user.id, active.schoolId);
  if (!data) {
    // Race / permissions edge — treat as "not allowed here"
    redirect("/dashboard");
  }

  return (
    <>
      <Topbar
        title="School"
        eyebrow={`${data.school.name} · ${data.members.length} member${data.members.length === 1 ? "" : "s"}`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        {/* Header card */}
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-5 md:p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[14px] font-bold tracking-tight text-white">
            {(data.school.shortName ?? data.school.name)
              .replace(/[^A-Za-z]/g, "")
              .slice(0, 3)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {data.school.name}
            </h1>
            {data.school.city ? (
              <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {data.school.city}
                {data.school.state ? `, ${data.school.state}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                data.viewerRole === "MANAGER"
                  ? "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]"
                  : "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
              )}
            >
              <ShieldCheck className="h-3 w-3" />
              {data.viewerRole.toLowerCase()}
              {data.isOwner ? " · owner" : ""}
            </span>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <MembersCard members={data.members} viewerRole={data.viewerRole} />
          </div>

          <div className="space-y-6">
            <SchoolInviteManager
              schoolId={data.school.id}
              schoolName={data.school.shortName ?? data.school.name}
              viewerRole={data.viewerRole}
              invites={data.outstandingInvites}
            />
          </div>
        </div>
      </main>
    </>
  );
}

// --- Members card -------------------------------------------------------

function MembersCard({
  members,
  viewerRole,
}: {
  members: SchoolMember[];
  viewerRole: "MANAGER" | "COACH";
}) {
  const managers = members.filter((m) => m.role === "MANAGER");
  const coaches = members.filter((m) => m.role === "COACH");
  const players = members.filter((m) => m.role === "PLAYER");

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          People
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-[color:var(--brand-crimson)]" />
          School roster
          <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {members.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {managers.length > 0 ? (
          <MemberSection title="Managers" members={managers} tone="gold" />
        ) : null}
        {coaches.length > 0 ? (
          <MemberSection title="Coaches" members={coaches} tone="purple" />
        ) : null}
        {players.length > 0 ? (
          <MemberSection title="Players" members={players} tone="muted" />
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-4 text-center text-[12px] text-muted-foreground">
            No players yet.{" "}
            {viewerRole === "MANAGER" || viewerRole === "COACH" ? (
              <>Use the invite panel on the right to add some.</>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberSection({
  title,
  members,
  tone,
}: {
  title: string;
  members: SchoolMember[];
  tone: "gold" | "purple" | "muted";
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]",
          tone === "gold" && "text-[color:var(--brand-gold)]",
          tone === "purple" && "text-[color:var(--brand-purple)]",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {title} · {members.length}
      </p>
      <ul className="space-y-0.5">
        {members.map((m) => (
          <li key={m.membershipId} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-card">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-white">
                {m.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((s) => s[0]?.toUpperCase() ?? "")
                  .join("") || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                {m.name}
                {m.isOwner ? (
                  <Crown className="ml-1 inline h-3 w-3 text-[color:var(--brand-gold)]" />
                ) : null}
              </p>
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate font-mono text-[10px]">{m.email}</span>
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              joined {m.joinedAt.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
