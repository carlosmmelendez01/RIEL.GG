import { Building2, Mail, Plus, Search, ShieldCheck, Users } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import {
  PLATFORM_LEAGUES,
  PLATFORM_SCHOOLS,
  type PlatformSchool,
} from "@/lib/mock/platform-data";
import { cn } from "@/lib/utils";

export default function PlatformSchoolsPage() {
  const all = PLATFORM_SCHOOLS;
  const active = all.filter((s) => s.status === "ACTIVE");
  const pending = all.filter((s) => s.status === "PENDING");
  const verified = all.filter((s) => s.ncesVerified).length;
  const multiLeague = all.filter((s) => s.leagueIds.length > 1).length;

  return (
    <>
      <PlatformTopbar
        title="Schools index"
        eyebrow={`${all.length} schools across the platform · ${verified} NCES-verified · ${multiLeague} compete in multiple leagues`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        {/* KPIs */}
        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Total schools" value={String(all.length)} icon={Building2} />
          <Stat label="NCES verified" value={`${verified}/${all.length}`} icon={ShieldCheck} tone="emerald" />
          <Stat label="Multi-league" value={String(multiLeague)} icon={Users} tone="purple" />
          <Stat label="Pending review" value={String(pending.length)} icon={ShieldCheck} tone="gold" />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, city, owner…"
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
            Onboard school
          </button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <SchoolTable items={all} />
          </TabsContent>
          <TabsContent value="active" className="mt-4">
            <SchoolTable items={active} />
          </TabsContent>
          <TabsContent value="pending" className="mt-4">
            <SchoolTable items={pending} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: typeof Building2;
  tone?: "default" | "emerald" | "purple" | "gold";
}) {
  const toneCls = {
    default: "border-border bg-background text-foreground",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    purple: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
    gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  }[tone];

  return (
    <Card className="hover-edge-crimson border-border/60 bg-card/80 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md border", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

const STATUS_TONE = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  PENDING: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  SUSPENDED: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

function SchoolTable({ items }: { items: PlatformSchool[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">No schools.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-3 pl-4 text-left font-medium">School</th>
                <th className="py-3 text-left font-medium">Owner</th>
                <th className="py-3 text-left font-medium">Leagues</th>
                <th className="py-3 text-left font-medium">Status</th>
                <th className="py-3 text-right font-medium">Students</th>
                <th className="py-3 pr-4 text-right font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <SchoolRow key={s.id} school={s} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SchoolRow({ school }: { school: PlatformSchool }) {
  const leagues = school.leagueIds
    .map((id) => PLATFORM_LEAGUES.find((l) => l.id === id))
    .filter(Boolean);

  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-card">
      <td className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-tight text-white shadow-inner"
            style={{ background: school.primaryColor }}
          >
            {school.code}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold">{school.name}</p>
              {school.ncesVerified ? (
                <span className="inline-flex items-center gap-0.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1 py-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  NCES
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {school.city}, {school.state}
              {school.ncesId ? <span className="ml-1.5 font-mono text-[10px]">· {school.ncesId}</span> : null}
            </p>
          </div>
        </div>
      </td>
      <td className="py-3">
        <p className="text-[13px]">{school.ownerName}</p>
        <a
          href={`mailto:${school.ownerEmail}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Mail className="h-3 w-3" />
          {school.ownerEmail}
        </a>
      </td>
      <td className="py-3">
        <div className="flex flex-wrap gap-1">
          {leagues.map((l) =>
            l ? (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px]"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: l.primaryColor }}
                />
                {l.shortName}
              </span>
            ) : null,
          )}
        </div>
      </td>
      <td className="py-3">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            STATUS_TONE[school.status],
          )}
        >
          {school.status}
        </span>
      </td>
      <td className="py-3 text-right font-mono tabular-nums">{school.studentCount}</td>
      <td className="py-3 pr-4 text-right text-[12px] text-muted-foreground">{school.joinedAgo} ago</td>
    </tr>
  );
}
