import { Mail, Plus, Search, ShieldCheck, UserCog, Users } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PLATFORM_ADMINS,
  PLATFORM_LEAGUES,
  type PlatformAdmin,
} from "@/lib/mock/platform-data";
import { cn } from "@/lib/utils";

export default function PlatformOwnersPage() {
  const all = PLATFORM_ADMINS;
  const owners = all.filter((a) => a.role === "OWNER");
  const admins = all.filter((a) => a.role === "ADMIN");
  const staff = all.filter((a) => a.role === "STAFF");
  const invited = all.filter((a) => a.status === "INVITED");

  return (
    <>
      <PlatformTopbar
        title="Owners & admins"
        eyebrow={`${all.length} privileged users across ${PLATFORM_LEAGUES.length} leagues · ${invited.length} invites pending`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Owners" value={String(owners.length)} icon={ShieldCheck} tone="crimson" />
          <Stat label="Admins" value={String(admins.length)} icon={UserCog} tone="purple" />
          <Stat label="Staff" value={String(staff.length)} icon={Users} />
          <Stat label="Pending invites" value={String(invited.length)} icon={Mail} tone="gold" />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or league…"
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
            Invite admin
          </button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="owners">Owners ({owners.length})</TabsTrigger>
            <TabsTrigger value="admins">Admins ({admins.length})</TabsTrigger>
            <TabsTrigger value="invited">Invited ({invited.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <AdminTable items={all} />
          </TabsContent>
          <TabsContent value="owners" className="mt-4">
            <AdminTable items={owners} />
          </TabsContent>
          <TabsContent value="admins" className="mt-4">
            <AdminTable items={admins} />
          </TabsContent>
          <TabsContent value="invited" className="mt-4">
            <AdminTable items={invited} />
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
  icon: typeof ShieldCheck;
  tone?: "default" | "crimson" | "purple" | "gold";
}) {
  const toneCls = {
    default: "border-border bg-background text-foreground",
    crimson: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
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

const ROLE_TONE = {
  OWNER: "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  ADMIN: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  STAFF: "border-border bg-background text-muted-foreground",
};

const STATUS_TONE = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  INVITED: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  INACTIVE: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

function AdminTable({ items }: { items: PlatformAdmin[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">No admins here.</CardContent>
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
                <th className="py-3 pl-4 text-left font-medium">Person</th>
                <th className="py-3 text-left font-medium">Role</th>
                <th className="py-3 text-left font-medium">League(s)</th>
                <th className="py-3 text-left font-medium">Status</th>
                <th className="py-3 text-right font-medium">Last active</th>
                <th className="py-3 pr-4 text-right font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <AdminRow key={a.id} admin={a} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminRow({ admin }: { admin: PlatformAdmin }) {
  const leagues = admin.leagueIds
    .map((id) => PLATFORM_LEAGUES.find((l) => l.id === id))
    .filter(Boolean);

  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-card">
      <td className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback
              className={cn(
                "text-[12px] font-semibold text-white",
                admin.role === "OWNER" ? "bg-[color:var(--brand-crimson)]" : admin.role === "ADMIN" ? "bg-[color:var(--brand-purple)]" : "bg-foreground/80",
              )}
            >
              {admin.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{admin.name}</p>
            <a
              href={`mailto:${admin.email}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3 w-3" />
              {admin.email}
            </a>
          </div>
        </div>
      </td>
      <td className="py-3">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            ROLE_TONE[admin.role],
          )}
        >
          {admin.role}
        </span>
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
            STATUS_TONE[admin.status],
          )}
        >
          {admin.status}
        </span>
      </td>
      <td className="py-3 text-right text-[12px] text-muted-foreground">
        {admin.lastActiveAgo ?? "—"}
      </td>
      <td className="py-3 pr-4 text-right text-[12px] text-muted-foreground">{admin.joinedAgo} ago</td>
    </tr>
  );
}
