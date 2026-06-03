"use client";

/**
 * Theme toggle button.
 *
 * Uses next-themes' `resolvedTheme` (not `theme`) so a user on "system"
 * mode still sees the correct icon for the resolved color scheme. A
 * `mounted` check avoids the hydration-mismatch flash that hits any
 * next-themes consumer on first render.
 */

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const subscribeMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle({
  className,
  variant = "outline",
}: {
  className?: string;
  /** `outline` = bordered button (default). `subtle` = ghost in topbars. */
  variant?: "outline" | "subtle";
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getServerSnapshot,
  );

  // Placeholder while hydrating — same dimensions, no icon swap flicker
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        disabled
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md",
          variant === "outline"
            ? "border border-border/60 bg-card/60"
            : "text-muted-foreground",
          className,
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors",
        variant === "outline" &&
          "border border-border/60 bg-card/60 text-foreground hover:bg-card",
        variant === "subtle" &&
          "text-muted-foreground hover:bg-card/60 hover:text-foreground",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
