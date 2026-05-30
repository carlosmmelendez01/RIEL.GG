"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Compass, Flame, Home, MessageCircle, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useViewer } from "@/components/auth/viewer-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Home", icon: Home, active: true },
  { label: "Explore", icon: Compass, active: false },
  { label: "Notifications", icon: Bell, active: false, badge: "3" },
  { label: "Messages", icon: MessageCircle, active: false },
];

export function TopNav({ winStreak }: { winStreak: number }) {
  const viewer = useViewer();
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                t.active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden md:inline">{t.label}</span>
              {t.badge ? (
                <span className="ml-1 rounded-full bg-[color:var(--brand-crimson)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {t.badge}
                </span>
              ) : null}
              {t.active ? (
                <span
                  aria-hidden
                  className="absolute -bottom-px left-2 right-2 h-[2px] rounded-full bg-[color:var(--brand-crimson)] shadow-[0_0_10px_oklch(0.4555_0.1734_19.27/60%)]"
                />
              ) : null}
            </button>
          ))}
        </nav>

        {/* Search */}
        <div className="ml-3 hidden flex-1 items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm text-muted-foreground md:flex md:max-w-md">
          <Search className="h-3.5 w-3.5" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players, teams, schools…"
            className="h-7 border-0 bg-transparent px-0 text-[13px] text-foreground shadow-none focus-visible:ring-0"
          />
          <kbd className="rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle */}
          <ThemeToggle variant="subtle" />

          {/* Create post */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand-crimson)] text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
            aria-label="Create post"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Streak pill */}
          <div className="hidden items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 sm:inline-flex">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-[12px] font-semibold tabular-nums text-orange-400">
              {winStreak}
            </span>
          </div>

          {/* User avatar dropdown trigger */}
          <Link
            href="/auth/sign-out"
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1 pr-2 transition-colors hover:bg-card"
            aria-label={viewer ? `Signed in as ${viewer.name}` : "Account"}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[10px] font-semibold tracking-tight text-white">
              {viewer?.initials ?? "??"}
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
