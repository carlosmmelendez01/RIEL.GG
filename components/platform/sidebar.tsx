"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  Building2,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
  badge?: string;
  badgeTone?: "crimson" | "gold";
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/platform", icon: LayoutDashboard }],
  },
  {
    label: "Tenancy",
    items: [
      { label: "Leagues", href: "/platform/leagues", icon: Trophy, badge: "5", badgeTone: "crimson" },
      { label: "Owners & admins", href: "/platform/owners", icon: ShieldCheck },
      { label: "Schools index", href: "/platform/schools", icon: Building2 },
      { label: "Activity feed", href: "/platform/activity", icon: Activity },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Game library", href: "/platform/games", icon: Globe2 },
      { label: "Templates", href: "/platform/templates", icon: Sparkles },
    ],
  },
  {
    label: "Commercial",
    items: [
      { label: "Plans", href: "/platform/plans", icon: Banknote, soon: true },
      { label: "Billing", href: "/platform/billing", icon: CreditCard, soon: true },
      { label: "Usage", href: "/platform/usage", icon: Zap, soon: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Audit log", href: "/platform/audit", icon: ScrollText },
      { label: "Support", href: "/platform/support", icon: LifeBuoy, badge: "10", badgeTone: "gold" },
      { label: "Members", href: "/platform/members", icon: Users },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Integrations", href: "/platform/integrations", icon: Plug },
      { label: "Settings", href: "/platform/settings", icon: Settings },
    ],
  },
];

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border/60 px-5">
        <Link href="/platform" aria-label="RIEL.GG platform">
          <RielLockup />
        </Link>
      </div>

      <div className="border-b border-sidebar-border/60 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Platform
        </p>
        <p className="mt-1 truncate text-sm font-semibold">RIEL.GG</p>
        <p className="truncate text-[11px] text-muted-foreground">Multi-tenant operator</p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/platform" && pathname.startsWith(item.href));
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
        <div className="rounded-lg border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/8 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-purple)]">
            Platform Mode
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You&apos;re managing the entire RIEL.GG platform across all tenant leagues.
          </p>
        </div>
      </div>
    </aside>
  );
}
