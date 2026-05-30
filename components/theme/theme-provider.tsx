"use client";

/**
 * Thin wrapper around `next-themes` ThemeProvider. Keeping the wrapper here
 * (instead of importing next-themes directly in the layout) lets us keep
 * app/layout.tsx as a Server Component while next-themes does its required
 * client-side work.
 *
 * Configured for class-based theme switching (`<html class="dark">`) with
 * a dark default — existing users see no visual change on first load. The
 * stored choice persists in localStorage automatically.
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
