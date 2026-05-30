import type { Metadata } from "next";

import { ViewerProvider } from "@/components/auth/viewer-provider";
import { HelpLauncher } from "@/components/support/help-launcher";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: { default: "My profile", template: "%s · RIEL.GG" },
};

/**
 * Minimal layout — the player profile page renders its own three-column
 * social shell (sidebar + top nav + content + right widgets), so this layout
 * just wires up the viewer context, a full-height bg, and the persistent
 * help launcher (so non-technical users always have a recovery path).
 */
export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <ViewerProvider viewer={viewer}>
      <div className="bg-system-gradient min-h-screen w-full bg-background">{children}</div>
      <HelpLauncher />
    </ViewerProvider>
  );
}
