import {
  Bug,
  CircleAlert,
  CreditCard,
  HelpCircle,
  LifeBuoy,
  Lightbulb,
  Plug,
  Search,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PLATFORM_LEAGUES,
  RIEL_STAFF,
  SUPPORT_TICKETS,
  type SupportTicket,
} from "@/lib/mock/platform-data";
import { cn } from "@/lib/utils";

const PRIORITY_TONE = {
  URGENT: "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  HIGH: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  MEDIUM: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  LOW: "border-border bg-background text-muted-foreground",
};

const STATUS_TONE = {
  OPEN: "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
  IN_PROGRESS: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  WAITING: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  RESOLVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CLOSED: "border-border bg-background text-muted-foreground",
};

const CATEGORY_ICON: Record<SupportTicket["category"], { icon: LucideIcon; label: string }> = {
  BILLING: { icon: CreditCard, label: "Billing" },
  BUG: { icon: Bug, label: "Bug" },
  FEATURE: { icon: Lightbulb, label: "Feature request" },
  QUESTION: { icon: HelpCircle, label: "Question" },
  ABUSE: { icon: Shield, label: "Abuse" },
  INTEGRATION: { icon: Plug, label: "Integration" },
};

export default function PlatformSupportPage() {
  const all = SUPPORT_TICKETS;
  const open = all.filter((t) => t.status === "OPEN");
  const inProgress = all.filter((t) => t.status === "IN_PROGRESS");
  const waiting = all.filter((t) => t.status === "WAITING");
  const resolved = all.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");

  const urgentCount = all.filter((t) => t.priority === "URGENT" && t.status !== "RESOLVED" && t.status !== "CLOSED").length;

  return (
    <>
      <PlatformTopbar
        title="Support"
        eyebrow={`${open.length + inProgress.length + waiting.length} active tickets · ${urgentCount} urgent`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Open" value={String(open.length)} tone="crimson" />
          <Stat label="In progress" value={String(inProgress.length)} tone="gold" />
          <Stat label="Waiting" value={String(waiting.length)} tone="purple" />
          <Stat label="Resolved (30d)" value={String(resolved.length)} tone="emerald" />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets, customers, ticket #…"
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">Active ({open.length + inProgress.length + waiting.length})</TabsTrigger>
            <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
            <TabsTrigger value="inProgress">In progress ({inProgress.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-2">
            {[...open, ...inProgress, ...waiting].map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </TabsContent>
          <TabsContent value="open" className="mt-4 space-y-2">
            {open.map((t) => <TicketRow key={t.id} ticket={t} />)}
          </TabsContent>
          <TabsContent value="inProgress" className="mt-4 space-y-2">
            {inProgress.map((t) => <TicketRow key={t.id} ticket={t} />)}
          </TabsContent>
          <TabsContent value="resolved" className="mt-4 space-y-2">
            {resolved.map((t) => <TicketRow key={t.id} ticket={t} />)}
          </TabsContent>
          <TabsContent value="all" className="mt-4 space-y-2">
            {all.map((t) => <TicketRow key={t.id} ticket={t} />)}
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "crimson" | "gold" | "purple" | "emerald";
}) {
  const toneCls = {
    crimson: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/8",
    gold: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/8",
    purple: "border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/8",
    emerald: "border-emerald-500/30 bg-emerald-500/8",
  }[tone];
  return (
    <Card className={cn("hover-edge-crimson border-border/60 bg-card/80 p-4", toneCls)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const league = ticket.raisedByLeagueId ? PLATFORM_LEAGUES.find((l) => l.id === ticket.raisedByLeagueId) : null;
  const assignee = ticket.assigneeId ? RIEL_STAFF.find((s) => s.id === ticket.assigneeId) : null;
  const cat = CATEGORY_ICON[ticket.category];
  const CatIcon = cat.icon;

  return (
    <Card className="hover-edge-crimson group border-border/60 bg-card/80 transition-colors">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
        <div className="flex shrink-0 items-start gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
              ticket.priority === "URGENT" || ticket.priority === "HIGH"
                ? "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]"
                : "border-border bg-background text-muted-foreground",
            )}
          >
            <CatIcon className="h-4 w-4" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{ticket.ticketNumber}</span>
            <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", PRIORITY_TONE[ticket.priority])}>
              {ticket.priority}
            </span>
            <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", STATUS_TONE[ticket.status])}>
              {ticket.status.replace("_", " ")}
            </span>
            <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {cat.label}
            </span>
          </div>
          <p className="mt-1.5 text-[14px] font-semibold leading-snug">{ticket.subject}</p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{ticket.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              <span className="text-foreground font-medium">{ticket.raisedByName}</span>{" "}
              <span className="font-mono text-[10px]">({ticket.raisedByEmail})</span>
            </span>
            {league ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: league.primaryColor }} />
                {league.shortName}
              </span>
            ) : null}
            <span aria-hidden>·</span>
            <span>opened {ticket.createdAgo} ago</span>
            <span aria-hidden>·</span>
            <span>updated {ticket.updatedAgo} ago</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {assignee ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-[color:var(--brand-crimson)] text-[9px] font-semibold text-white">
                  {assignee.initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px]">{assignee.name.split(" ")[0]}</span>
            </div>
          ) : (
            <span className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
              Unassigned
            </span>
          )}
          <button className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>Open</button>
        </div>
      </CardContent>
    </Card>
  );
}

void LifeBuoy;
void CircleAlert;
