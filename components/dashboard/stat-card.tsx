import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: { value: string; trend: "up" | "down" | "flat" };
  icon: LucideIcon;
  tone?: "default" | "crimson" | "gold";
}) {
  const TrendIcon = delta?.trend === "down" ? TrendingDown : TrendingUp;
  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card/80 p-5 transition-colors hover:bg-card">
      <div
        aria-hidden
        className={cn(
          "absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-30",
          tone === "crimson" && "bg-[color:var(--brand-crimson)]",
          tone === "gold" && "bg-[color:var(--brand-gold)]",
          tone === "default" && "bg-foreground/30",
        )}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border",
            tone === "crimson" && "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
            tone === "gold" && "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
            tone === "default" && "border-border bg-background text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative mt-5 flex items-baseline gap-3">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {delta ? (
          <span
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              delta.trend === "up" && "text-emerald-700 dark:text-emerald-400",
              delta.trend === "down" && "text-[color:var(--brand-crimson)]",
              delta.trend === "flat" && "text-muted-foreground",
            )}
          >
            {delta.trend !== "flat" ? <TrendIcon className="h-3 w-3" /> : null}
            {delta.value}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
