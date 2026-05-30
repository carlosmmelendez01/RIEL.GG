"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ViewerInfo } from "@/components/auth/mode-switcher";

const ViewerContext = createContext<ViewerInfo | null>(null);

/**
 * Provide the resolved viewer info to descendant client components.
 * Pass `null` if no signed-in user (rare on protected routes — proxy.ts gates them).
 */
export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: ViewerInfo | null;
  children: ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

/**
 * Hook for client components inside a ViewerProvider.
 * Returns null when there's no signed-in user — most protected UI should branch off this.
 */
export function useViewer(): ViewerInfo | null {
  return useContext(ViewerContext);
}
