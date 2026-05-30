import { Crown, Mail, Plus, Search, Users } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RIEL_STAFF, type RielStaff } from "@/lib/mock/platform-data";
import { cn } from "@/lib/utils";

const ROLE_TONE = {
  FOUNDER: "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  ADMIN: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  ENGINEER: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  SUPPORT: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  DESIGN: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  SALES: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const STATUS_TONE = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  AWAY: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  INVITED: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
};

export default function PlatformMembersPage() {
  const all = RIEL_STAFF;
  const active = all.filter((m) => m.status === "ACTIVE").length;
  const invited = all.filter((m) => m.status === "INVITED").length;

  return (
    <>
      <PlatformTopbar
        title="Members"
        eyebrow={`RIEL.GG internal team · ${active} active · ${invited} pending invite`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members…"
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <button
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
            )}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Invite member
          </button>
        </div>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="py-3 pl-4 text-left font-medium">Member</th>
                    <th className="py-3 text-left font-medium">Role</th>
                    <th className="py-3 text-left font-medium">Status</th>
                    <th className="py-3 text-right font-medium">Last active</th>
                    <th className="py-3 pr-4 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((m) => (
                    <MemberRow key={m.id} member={m} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-purple)]" />
            <div>
              <p className="text-[13px] font-semibold">RIEL.GG internal access</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Members listed here have platform-level access — they can see across all tenant leagues. League-scoped
                admins (e.g., HEA staff) live under <span className="font-mono">/platform/owners</span> instead.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function MemberRow({ member }: { member: RielStaff }) {
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-card">
      <td className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback
              className={cn(
                "text-[12px] font-semibold text-white",
                member.role === "FOUNDER"
                  ? "bg-[color:var(--brand-crimson)]"
                  : member.role === "ADMIN"
                    ? "bg-[color:var(--brand-purple)]"
                    : "bg-foreground/80",
              )}
            >
              {member.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold">{member.name}</p>
              {member.role === "FOUNDER" ? (
                <Crown className="h-3 w-3 text-[color:var(--brand-gold)]" />
              ) : null}
            </div>
            <a
              href={`mailto:${member.email}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3 w-3" />
              {member.email}
            </a>
          </div>
        </div>
      </td>
      <td className="py-3">
        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              "inline-block w-fit rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              ROLE_TONE[member.role],
            )}
          >
            {member.role}
          </span>
          <span className="text-[11px] text-muted-foreground">{member.title}</span>
        </div>
      </td>
      <td className="py-3">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            STATUS_TONE[member.status],
          )}
        >
          {member.status}
        </span>
      </td>
      <td className="py-3 text-right text-[12px] text-muted-foreground">{member.lastActiveAgo ?? "—"}</td>
      <td className="py-3 pr-4 text-right text-[12px] text-muted-foreground">{member.joinedAgo} ago</td>
    </tr>
  );
}
