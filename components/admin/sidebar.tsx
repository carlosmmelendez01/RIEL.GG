"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CalendarRange,
  CircleAlert,
  FileBarChart,
  Gamepad2,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  Network,
  Plug,
  ScrollText,
  Settings,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { BetaBadge } from "@/components/brand/beta-badge";
import { useViewer } from "@/components/auth/viewer-provider";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
  badge?: string;
  badgeTone?: "crimson" | "gold";
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Board", href: "/admin/board", icon: BarChart3 },
    ],
  },
  {
    label: "Season",
    items: [
      { label: "Seasons", href: "/admin/seasons", icon: CalendarRange, soon: true },
      { label: "Competitions", href: "/admin/competitions", icon: Trophy },
      { label: "Game catalog", href: "/admin/games", icon: Gamepad2, soon: true },
      { label: "Tournaments", href: "/admin/tournaments", icon: Network, soon: true },
    ],
  },
  {
    label: "Participants",
    items: [
      { label: "Schools", href: "/admin/schools", icon: Building2 },
      { label: "Teams", href: "/admin/teams", icon: Users, soon: true },
      { label: "Coaches", href: "/admin/coaches", icon: UserCog, soon: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Scheduler", href: "/admin/scheduler", icon: Wand2 },
      { label: "All matches", href: "/admin/matches", icon: Calendar },
      { label: "Disputes", href: "/admin/disputes", icon: CircleAlert, soon: true },
      { label: "Reports", href: "/admin/reports", icon: FileBarChart, soon: true },
      { label: "Audit log", href: "/admin/audit", icon: ScrollText, soon: true },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Announcements", href: "/admin/announcements", icon: Megaphone, soon: true },
      { label: "Unified", href: "/admin/unified", icon: HeartHandshake, soon: true },
      { label: "Insights", href: "/admin/insights", icon: Sparkles, soon: true },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Branding", href: "/admin/branding", icon: Activity, soon: true },
      { label: "Integrations", href: "/admin/integrations", icon: Plug, soon: true },
      { label: "Settings", href: "/admin/settings", icon: Settings, soon: true },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const viewer = useViewer();
  // viewer.subtitle.admin reads like "RIEL Esports League · Owner" — split
  // the real league name out of it so the header reflects whoever's signed in.
  const adminSubtitle = viewer?.subtitle.admin ?? "";
  const [leagueName, leagueRole] = adminSubtitle.includes(" · ")
    ? adminSubtitle.split(" · ")
    : [adminSubtitle || "Your league", ""];

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border/60 px-5">
        <Link href="/admin" aria-label="RIEL.GG admin">
          <RielLockup />
        </Link>
        <BetaBadge />
      </div>

      <div className="border-b border-sidebar-border/60 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          League
        </p>
        <p className="mt-1 truncate text-sm font-semibold">{leagueName}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {leagueRole ? `${leagueRole} · ` : ""}Spring 2026
        </p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
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
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            item.badgeTone === "crimson" &&
                              "bg-[color:var(--brand-crimson)]/15 text-[color:var(--brand-crimson)]",
                            item.badgeTone === "gold" &&
                              "bg-[color:var(--brand-gold)]/15 text-[color:var(--brand-gold)]",
                          )}
                        >
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
        <div className="rounded-lg border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/8 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-crimson)]">
            Admin Mode
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You're managing the entire league. Switch back via the user menu.
          </p>
        </div>
      </div>
    </aside>
  );
}
