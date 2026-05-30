import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plug,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { INTEGRATIONS, type Integration } from "@/lib/mock/platform-data";
import { cn } from "@/lib/utils";

const STATUS_TONE = {
  CONNECTED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  DEGRADED: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  DISCONNECTED: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  AVAILABLE: "border-border bg-background text-muted-foreground",
};

const CATEGORY_LABEL = {
  GAME_API: "Game API",
  COMMS: "Communications",
  AUTH: "Authentication",
  ANALYTICS: "Analytics",
  PAYMENTS: "Payments",
  DATA: "Data",
};

export default function PlatformIntegrationsPage() {
  const all = INTEGRATIONS;
  const connected = all.filter((i) => i.status === "CONNECTED");
  const degraded = all.filter((i) => i.status === "DEGRADED");
  const disconnected = all.filter((i) => i.status === "DISCONNECTED");
  const available = all.filter((i) => i.status === "AVAILABLE");

  return (
    <>
      <PlatformTopbar
        title="Integrations"
        eyebrow={`${connected.length} connected · ${degraded.length} degraded · ${available.length} available to enable`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        {/* Health overview */}
        <section className="grid gap-3 sm:grid-cols-4">
          <HealthCard label="Connected" value={String(connected.length)} icon={CheckCircle2} tone="emerald" />
          <HealthCard label="Degraded" value={String(degraded.length)} icon={AlertTriangle} tone="gold" />
          <HealthCard label="Disconnected" value={String(disconnected.length)} icon={AlertTriangle} tone="orange" />
          <HealthCard label="Available" value={String(available.length)} icon={Sparkles} tone="purple" />
        </section>

        {degraded.length + disconnected.length > 0 ? (
          <Card className="border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-gold)]" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold">Integration health needs attention</p>
                <ul className="mt-1.5 space-y-0.5 text-[12px] text-muted-foreground">
                  {[...degraded, ...disconnected].map((i) => (
                    <li key={i.id}>
                      <span className="text-foreground font-medium">{i.name}</span> — {i.errorMessage}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search integrations…"
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="connected">Connected ({connected.length})</TabsTrigger>
            <TabsTrigger value="degraded">Issues ({degraded.length + disconnected.length})</TabsTrigger>
            <TabsTrigger value="available">Available ({available.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <IntegrationGrid items={all} />
          </TabsContent>
          <TabsContent value="connected" className="mt-4">
            <IntegrationGrid items={connected} />
          </TabsContent>
          <TabsContent value="degraded" className="mt-4">
            <IntegrationGrid items={[...degraded, ...disconnected]} />
          </TabsContent>
          <TabsContent value="available" className="mt-4">
            <IntegrationGrid items={available} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function HealthCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof CheckCircle2;
  tone: "emerald" | "gold" | "orange" | "purple";
}) {
  const toneCls = {
    emerald: "border-emerald-500/30 bg-emerald-500/8",
    gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/8",
    orange: "border-orange-500/30 bg-orange-500/8",
    purple: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/8",
  }[tone];
  const iconCls = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    purple: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  }[tone];

  return (
    <Card className={cn("hover-edge-crimson border-border/60 bg-card/80 p-4", toneCls)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md border", iconCls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

function IntegrationGrid({ items }: { items: Integration[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No integrations here.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <IntegrationCard key={i.id} integration={i} />
      ))}
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const adoption = Math.round((integration.connectedLeagueCount / Math.max(1, integration.totalLeagueCount)) * 100);

  return (
    <Card className="group hover-edge-crimson border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[16px] font-bold text-white shadow-inner"
              style={{ background: integration.iconColor }}
            >
              {integration.iconLetter}
            </div>
            <div>
              <CardTitle className="text-[15px] font-semibold tracking-tight">{integration.name}</CardTitle>
              <p className="text-[11px] text-muted-foreground">{CATEGORY_LABEL[integration.category]}</p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              STATUS_TONE[integration.status],
            )}
          >
            {integration.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] leading-snug text-muted-foreground">{integration.description}</p>

        {integration.errorMessage ? (
          <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-2 text-[11px]">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-orange-700 dark:text-orange-400" />
              <span className="text-orange-700 dark:text-orange-400">{integration.errorMessage}</span>
            </p>
          </div>
        ) : null}

        {integration.status !== "AVAILABLE" ? (
          <div>
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>League adoption</span>
              <span className="font-mono tabular-nums text-foreground">
                {integration.connectedLeagueCount}/{integration.totalLeagueCount}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[color:var(--brand-crimson)]"
                style={{ width: `${adoption}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          {integration.lastSyncAgo ? (
            <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last sync {integration.lastSyncAgo} ago
            </p>
          ) : (
            <span className="text-[11px] text-muted-foreground">Not yet enabled</span>
          )}
          {integration.status === "AVAILABLE" ? (
            <button
              className={cn(
                buttonVariants({ size: "xs" }),
                "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
              )}
            >
              <Plug className="mr-1 h-3 w-3" />
              Connect
            </button>
          ) : (
            <button className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
              <Settings className="mr-1 h-3 w-3" />
              Configure
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
