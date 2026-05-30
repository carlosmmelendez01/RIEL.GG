"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Calendar,
  Users,
  UserCircle2,
  Trophy,
  Megaphone,
  MessageSquare,
  Network,
  Sparkles,
  Settings,
  Swords,
  HeartHandshake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { BetaBadge } from "@/components/brand/beta-badge";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
  badge?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    label: "Program",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Home },
      { label: "Schedule", href: "/dashboard/matches", icon: Calendar, badge: "3" },
      { label: "School", href: "/dashboard/school", icon: Building2 },
      { label: "Teams", href: "/dashboard/teams", icon: Users },
      { label: "Players", href: "/dashboard/players", icon: UserCircle2, soon: true },
      { label: "Standings", href: "/dashboard/standings", icon: Trophy },
      { label: "Brackets", href: "/dashboard/brackets", icon: Swords, soon: true },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Announcements", href: "/dashboard/announcements", icon: Megaphone, soon: true },
      { label: "Messages", href: "/dashboard/messages", icon: MessageSquare, soon: true },
    ],
  },
  {
    label: "League",
    items: [
      { label: "Divisions", href: "/dashboard/divisions", icon: Network, soon: true },
      { label: "Unified", href: "/dashboard/unified", icon: HeartHandshake, soon: true },
      { label: "Insights", href: "/dashboard/insights", icon: Sparkles, soon: true },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, soon: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border/60 px-5">
        <Link href="/dashboard" aria-label="RIEL.GG dashboard">
          <RielLockup />
        </Link>
        <BetaBadge />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.soon ? "#" : item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                        item.soon && "cursor-not-allowed opacity-50 hover:bg-transparent",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-3 -translate-y-1/2 rounded-full bg-[color:var(--brand-crimson)] shadow-[0_0_10px_oklch(0.4555_0.1734_19.27/60%)]"
                        />
                      ) : null}
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-[color:var(--brand-crimson)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--brand-crimson)]">
                          {item.badge}
                        </span>
                      ) : null}
                      {item.soon ? (
                        <span className="rounded-full border border-border/60 px-1.5 py-0 text-[9px] uppercase tracking-wider text-muted-foreground">
                          soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border/60 p-3">
        <div className="rounded-lg border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-gold)]">
            Beta
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You&apos;re previewing RIEL.GG. Spot something off? Use the Feedback button.
          </p>
        </div>
      </div>
    </aside>
  );
}
