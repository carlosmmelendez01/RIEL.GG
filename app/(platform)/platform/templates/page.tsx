import { ArrowRight, HeartHandshake, Plus, Search, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { PLATFORM_TEMPLATES, type PlatformTemplate } from "@/lib/mock/platform-data";
import { cn } from "@/lib/utils";

export default function PlatformTemplatesPage() {
  const all = PLATFORM_TEMPLATES;
  const recommended = all.filter((t) => t.recommended);
  const varsity = all.filter((t) => t.category === "VARSITY");
  const jv = all.filter((t) => t.category === "JV");
  const unified = all.filter((t) => t.category === "UNIFIED");
  const tournaments = all.filter((t) => t.category === "TOURNAMENT");

  return (
    <>
      <PlatformTopbar
        title="Competition templates"
        eyebrow={`${all.length} templates · ${recommended.length} recommended · used in ${all.reduce((s, t) => s + t.usedByCompetitionCount, 0)} active competitions`}
      />

      <main className="flex-1 space-y-6 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm md:flex md:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
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
            New template
          </button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="recommended">Recommended ({recommended.length})</TabsTrigger>
            <TabsTrigger value="varsity">Varsity ({varsity.length})</TabsTrigger>
            <TabsTrigger value="jv">JV ({jv.length})</TabsTrigger>
            <TabsTrigger value="unified">Unified ({unified.length})</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments ({tournaments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <TemplateGrid items={all} />
          </TabsContent>
          <TabsContent value="recommended" className="mt-4">
            <TemplateGrid items={recommended} />
          </TabsContent>
          <TabsContent value="varsity" className="mt-4">
            <TemplateGrid items={varsity} />
          </TabsContent>
          <TabsContent value="jv" className="mt-4">
            <TemplateGrid items={jv} />
          </TabsContent>
          <TabsContent value="unified" className="mt-4">
            <TemplateGrid items={unified} />
          </TabsContent>
          <TabsContent value="tournaments" className="mt-4">
            <TemplateGrid items={tournaments} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

const CATEGORY_TONE: Record<PlatformTemplate["category"], { label: string; cls: string; icon: LucideIcon }> = {
  VARSITY: {
    label: "Varsity",
    cls: "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
    icon: Trophy,
  },
  JV: {
    label: "JV",
    cls: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
    icon: Trophy,
  },
  UNIFIED: {
    label: "Unified",
    cls: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
    icon: HeartHandshake,
  },
  TOURNAMENT: {
    label: "Tournament",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: Trophy,
  },
  SHOWCASE: {
    label: "Showcase",
    cls: "border-border bg-background text-muted-foreground",
    icon: Sparkles,
  },
};

function TemplateGrid({ items }: { items: PlatformTemplate[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">No templates here.</CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((t) => (
        <TemplateCard key={t.id} template={t} />
      ))}
    </div>
  );
}

function TemplateCard({ template }: { template: PlatformTemplate }) {
  const cat = CATEGORY_TONE[template.category];
  const CatIcon = cat.icon;

  return (
    <Card
      className={cn(
        "group hover-edge-crimson border-border/60 bg-card/80 transition-colors",
        template.recommended && "ring-1 ring-[color:var(--brand-crimson)]/25",
      )}
    >
      <CardHeader className="pb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              cat.cls,
            )}
          >
            <CatIcon className="h-3 w-3" />
            {cat.label}
          </span>
          {template.recommended ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[color:var(--brand-crimson)]">
              <Sparkles className="h-3 w-3" />
              Recommended
            </span>
          ) : null}
        </div>
        <CardTitle className="text-[15px] font-semibold tracking-tight">{template.name}</CardTitle>
        <p className="text-[12px] leading-snug text-muted-foreground">{template.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-md border border-border/60 bg-background/40 p-2 text-center">
          <Stat label="Game" value={template.game.split(" ")[0]} />
          <Stat label="Format" value={template.format} />
          <Stat label="Best of" value={String(template.bestOf)} />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Stages
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {template.stages.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 ? <ArrowRight className="h-3 w-3 text-muted-foreground/50" /> : null}
                <span className="rounded-md border border-border bg-background px-1.5 py-0.5">
                  {s}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[11px]">
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{template.usedByLeagueCount}</span>{" "}
            league{template.usedByLeagueCount === 1 ? "" : "s"} use this
          </span>
          <button
            className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
          >
            Use template
            <ArrowRight className="ml-1 h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[12px] font-semibold">{value}</p>
    </div>
  );
}
