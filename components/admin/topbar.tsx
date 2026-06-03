"use client";

import { ShieldCheck } from "lucide-react";

import { ModeSwitcher } from "@/components/auth/mode-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useViewer } from "@/components/auth/viewer-provider";

export function AdminTopbar({ title, eyebrow }: { title: string; eyebrow?: string }) {
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
          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-crimson)]">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </span>
        </div>
      </div>

      <ThemeToggle variant="subtle" />

      {viewer ? <ModeSwitcher current="admin" viewer={viewer} /> : null}
    </header>
  );
}
