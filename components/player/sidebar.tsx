"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Bookmark,
  Calendar,
  Compass,
  GraduationCap,
  Home,
  MessageCircle,
  MessagesSquare,
  Smartphone,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { BetaBadge } from "@/components/brand/beta-badge";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  soon?: boolean;
};

type NavSection = { label?: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Feed", href: "/me", icon: Home },
      { label: "Explore", href: "/explore", icon: Compass, soon: true },
      { label: "Notifications", href: "/notifications", icon: Bell, soon: true },
      { label: "Messages", href: "/messages", icon: MessageCircle, soon: true },
      { label: "Bookmarks", href: "/bookmarks", icon: Bookmark, soon: true },
    ],
  },
  {
    label: "Compete",
    items: [
      { label: "Matches", href: "/me/matches", icon: Swords, soon: true },
      { label: "Schedule", href: "/me/schedule", icon: Calendar, soon: true },
      { label: "Standings", href: "/me/standings", icon: BarChart3, soon: true },
      { label: "Tournaments", href: "/me/tournaments", icon: Trophy, soon: true },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "My Team", href: "/me/team", icon: Users2, soon: true },
      { label: "Team Chat", href: "/me/team/chat", icon: MessagesSquare, soon: true },
      { label: "Scrims", href: "/me/scrims", icon: Activity, soon: true },
    ],
  },
  {
    label: "Grow",
    items: [
      { label: "Recruiting", href: "/me/recruiting", icon: GraduationCap, soon: true },
      { label: "Goals", href: "/me/goals", icon: Target, soon: true },
      { label: "Analytics", href: "/me/analytics", icon: BarChart3, soon: true },
    ],
  },
];

export function PlayerSidebar({
  user,
}: {
  user: { fullName: string; initials: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex">
      {/* Logo + identity */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border/60 px-5">
        <Link href="/me" aria-label="RIEL.GG home">
          <RielLockup height={28} />
        </Link>
        <BetaBadge />
      </div>

      <Link
        href="/me"
        className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3 transition-colors hover:bg-card"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[12px] font-semibold tracking-tight text-[color:var(--brand-crimson)]">
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[13px] font-semibold">
            {user.fullName}
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-crimson)]" />
          </p>
          <p className="text-[11px] text-muted-foreground">View my profile</p>
        </div>
      </Link>

      {/* Nav sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section, idx) => (
          <div key={idx}>
            {section.label ? (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
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
                        item.soon && "cursor-not-allowed opacity-60 hover:bg-transparent",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-3 -translate-y-1/2 rounded-full bg-[color:var(--brand-crimson)] shadow-[0_0_10px_oklch(0.4555_0.1734_19.27/60%)]"
                        />
                      ) : null}
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-[color:var(--brand-crimson)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {item.badge}
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

      {/* Mobile App promo */}
      <div className="border-t border-sidebar-border/60 p-3">
        <div className="relative overflow-hidden rounded-xl border border-[color:var(--brand-crimson)]/30 bg-gradient-to-br from-[color:var(--brand-crimson)]/15 via-card/85 to-[color:var(--brand-purple)]/10 p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-8 h-32 w-24 rounded-2xl border border-[color:var(--brand-crimson)]/40 bg-gradient-to-br from-[color:var(--brand-crimson)]/30 via-background/60 to-[color:var(--brand-purple)]/20 opacity-80 blur-[1px]"
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-crimson)]">
              RIEL Mobile App
            </p>
            <p className="mt-1 text-[12px] leading-snug text-foreground">
              Your journey.
              <br />
              Your stats.
              <br />
              Anywhere.
            </p>
            <button
              disabled
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-70"
              title="Mobile app coming soon"
            >
              <Smartphone className="h-3 w-3" />
              Download App
            </button>
          </div>
        </div>

        {/* Social icons */}
        <div className="mt-3 flex items-center justify-center gap-3 text-muted-foreground/60">
          <a className="hover:text-foreground" href="#" aria-label="Twitter">
            <Sparkles className="h-3.5 w-3.5" />
          </a>
          <a className="hover:text-foreground" href="#" aria-label="Discord">
            <MessagesSquare className="h-3.5 w-3.5" />
          </a>
          <a className="hover:text-foreground" href="#" aria-label="YouTube">
            <Activity className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
