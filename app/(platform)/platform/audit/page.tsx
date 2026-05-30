import {
  Banknote,
  Building2,
  CheckCircle2,
  CircleAlert,
  Download,
  Filter,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AUDIT_EVENTS,
  PLATFORM_LEAGUES,
  type AuditEvent,
  type AuditEventKind,
} from "@/lib/mock/platform-data";
import { cn } from "@/lib/utils";

const KIND_META: Record<AuditEventKind, { icon: LucideIcon; tone: string; label: string }> = {
  "LEAGUE.CREATE": { icon: Sparkles, tone: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]", label: "League created" },
  "LEAGUE.UPDATE": { icon: Settings, tone: "border-border bg-background text-muted-foreground", label: "League updated" },
  "LEAGUE.SUSPEND": { icon: CircleAlert, tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400", label: "League suspended" },
  "SCHOOL.APPROVE": { icon: CheckCircle2, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "School approved" },
  "SCHOOL.REJECT": { icon: CircleAlert, tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400", label: "School rejected" },
  "COMPETITION.CREATE": { icon: Trophy, tone: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]", label: "Competition created" },
  "COMPETITION.ACTIVATE": { icon: CheckCircle2, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Competition activated" },
  "MATCH.SCORE_EDIT": { icon: ScrollText, tone: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]", label: "Match score edited" },
  "MATCH.CONFIRM": { icon: ShieldCheck, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Match confirmed" },
  "INVITE.ACTIVATE": { icon: ShieldCheck, tone: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]", label: "Invite activated" },
  "INVITE.REVOKE": { icon: CircleAlert, tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400", label: "Invite revoked" },
  "BILLING.UPGRADE": { icon: Banknote, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Billing upgrade" },
  "BILLING.DOWNGRADE": { icon: Banknote, tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400", label: "Billing downgrade" },
  "INTEGRATION.CONNECT": { icon: Plug, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Integration connected" },
  "INTEGRATION.DISCONNECT": { icon: Plug, tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400", label: "Integration disconnected" },
  "USER.ROLE_CHANGE": { icon: UserCog, tone: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]", label: "Role changed" },
  "PLATFORM.SETTING_CHANGE": { icon: Settings, tone: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]", label: "Platform setting changed" },
};

export default function PlatformAuditPage() {
  return (
    <>
      <PlatformTopbar
        title="Audit log"
        eyebrow={`Tamper-evident record of every state-changing action across RIEL.GG · ${AUDIT_EVENTS.length} events shown`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Filter className="mr-1.5 h-3 w-3" />
              All actions
            </button>
            <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Filter className="mr-1.5 h-3 w-3" />
              All leagues
            </button>
            <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Filter className="mr-1.5 h-3 w-3" />
              Last 30 days
            </button>
            <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Filter className="mr-1.5 h-3 w-3" />
              All actors
            </button>
          </div>
          <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Download className="mr-1.5 h-3 w-3" />
            Export CSV
          </button>
        </div>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="py-3 pl-4 text-left font-medium">When</th>
                    <th className="py-3 text-left font-medium">Actor</th>
                    <th className="py-3 text-left font-medium">Action</th>
                    <th className="py-3 text-left font-medium">Description</th>
                    <th className="py-3 text-left font-medium">League</th>
                    <th className="py-3 pr-4 text-right font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {AUDIT_EVENTS.map((evt) => (
                    <AuditRow key={evt.id} event={evt} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-[color:var(--brand-purple)]" />
              Audit log integrity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[12px] text-muted-foreground">
            <p>
              · Audit events are append-only. Edits and deletions are themselves recorded as events with
              before/after JSON snapshots.
            </p>
            <p>· Cross-cuts league + platform scopes — filter by league to scope to one tenant.</p>
            <p>
              · Retention: 7 years on Tier 2+ plans. CSV export available for compliance review (FERPA, IPSO,
              SOC 2).
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const meta = KIND_META[event.action];
  const Icon = meta.icon;
  const league = event.leagueId ? PLATFORM_LEAGUES.find((l) => l.id === event.leagueId) : null;
  const initials = event.actor === "Auto-system" ? "SYS" : event.actor.split(" ").map((w) => w[0]).join("").slice(0, 2);

  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-card">
      <td className="py-3 pl-4 text-[12px] text-muted-foreground">{event.ts}</td>
      <td className="py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-foreground/80 text-[10px] font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[12px] font-medium">{event.actor}</p>
            {event.actorEmail ? (
              <p className="font-mono text-[10px] text-muted-foreground">{event.actorEmail}</p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            meta.tone,
          )}
        >
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </td>
      <td className="py-3 max-w-md text-[12px] leading-snug">{event.description}</td>
      <td className="py-3">
        {league ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: league.primaryColor }} />
            {league.shortName}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 px-1.5 py-0.5 text-[11px] text-[color:var(--brand-purple)]">
            <Building2 className="h-3 w-3" />
            Platform
          </span>
        )}
      </td>
      <td className="py-3 pr-4 text-right font-mono text-[11px] text-muted-foreground">
        {event.ip ?? "—"}
      </td>
    </tr>
  );
}
