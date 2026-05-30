"use client";

import Link from "next/link";
import { Check, ChevronDown, LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ViewerInfo = {
  name: string;
  initials: string;
  email: string;
  subtitle: { coach: string; admin: string; platform: string };
  // `board` gates the BoardSnapshot section on /admin and access to
  // /admin/board. Currently true for league OWNER/ADMIN/STAFF and platform
  // owners; later we may carve out a strict view-only BOARD_MEMBER role.
  canView: { coach: boolean; admin: boolean; platform: boolean; board: boolean };
};

export type ModeKind = "coach" | "admin" | "platform";

export function ModeSwitcher({ current, viewer }: { current: ModeKind; viewer: ViewerInfo }) {
  const subtitle = viewer.subtitle[current];

  const avatarTone =
    current === "platform"
      ? "bg-[color:var(--brand-purple)]"
      : current === "admin"
        ? "bg-[color:var(--brand-crimson)]"
        : "bg-foreground/80";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full border border-border/60 bg-card/60 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-card">
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn("text-[12px] font-semibold text-white", avatarTone)}>
            {viewer.initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left sm:block">
          <p className="text-[13px] font-semibold leading-snug">{viewer.name}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Signed in as</p>
            <p className="mt-0.5 truncate text-[12px] font-medium text-foreground">{viewer.name}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{viewer.email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Switch view
          </DropdownMenuLabel>

          {viewer.canView.platform ? (
            <DropdownMenuItem className="py-2" render={<Link href="/platform" />}>
              <div className="flex w-full items-center gap-2">
                <div className="flex-1">
                  <p className="text-[13px] font-medium">Platform owner</p>
                  <p className="text-[11px] text-muted-foreground">{viewer.subtitle.platform}</p>
                </div>
                {current === "platform" ? (
                  <Check className="h-4 w-4 text-[color:var(--brand-purple)]" />
                ) : null}
              </div>
            </DropdownMenuItem>
          ) : null}

          {viewer.canView.admin ? (
            <DropdownMenuItem className="py-2" render={<Link href="/admin" />}>
              <div className="flex w-full items-center gap-2">
                <div className="flex-1">
                  <p className="text-[13px] font-medium">League admin</p>
                  <p className="text-[11px] text-muted-foreground">{viewer.subtitle.admin}</p>
                </div>
                {current === "admin" ? (
                  <Check className="h-4 w-4 text-[color:var(--brand-crimson)]" />
                ) : null}
              </div>
            </DropdownMenuItem>
          ) : null}

          {viewer.canView.coach ? (
            <DropdownMenuItem className="py-2" render={<Link href="/dashboard" />}>
              <div className="flex w-full items-center gap-2">
                <div className="flex-1">
                  <p className="text-[13px] font-medium">Coach</p>
                  <p className="text-[11px] text-muted-foreground">{viewer.subtitle.coach}</p>
                </div>
                {current === "coach" ? (
                  <Check className="h-4 w-4 text-[color:var(--brand-crimson)]" />
                ) : null}
              </div>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Account
          </DropdownMenuLabel>
          <DropdownMenuItem className="text-[13px]">
            <Settings className="mr-2 h-3.5 w-3.5" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem className="text-[13px]" render={<Link href="/auth/sign-out" />}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
