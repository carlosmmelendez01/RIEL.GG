"use client";

import { ModeSwitcher } from "@/components/auth/mode-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useViewer } from "@/components/auth/viewer-provider";

export function Topbar({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const viewer = useViewer();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/85 px-6 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <ThemeToggle variant="subtle" />

      {viewer ? <ModeSwitcher current="coach" viewer={viewer} /> : null}
    </header>
  );
}
