"use client";

import { Bell, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModeSwitcher } from "@/components/auth/mode-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useViewer } from "@/components/auth/viewer-provider";

export function PlatformTopbar({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const viewer = useViewer();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/85 px-6 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-purple)]">
            <Sparkles className="h-3 w-3" />
            Platform
          </span>
        </div>
      </div>

      <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm text-muted-foreground md:flex md:w-72">
        <Search className="h-4 w-4" />
        <span className="flex-1">Search leagues, owners, schools…</span>
        <kbd className="rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <ThemeToggle variant="subtle" />

      <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
        <Bell className="h-4 w-4" />
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[color:var(--brand-purple)]" />
      </Button>

      {viewer ? <ModeSwitcher current="platform" viewer={viewer} /> : null}
    </header>
  );
}
