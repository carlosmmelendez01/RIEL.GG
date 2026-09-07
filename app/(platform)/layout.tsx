import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PlatformSidebar } from "@/components/platform/sidebar";
import { ViewerProvider } from "@/components/auth/viewer-provider";
import { HelpLauncher } from "@/components/support/help-launcher";
import { getViewer } from "@/lib/auth/viewer";
import { isPlatformAdmin, platformAdminEnabled } from "@/lib/auth/platform";

export const metadata: Metadata = {
  title: { default: "Platform", template: "%s · ArcLight Platform" },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // Off by default. These pages still render fabricated schools and audit rows
  // from lib/mock/*, so the whole route group 404s unless a deployment sets
  // ENABLE_PLATFORM_ADMIN. notFound() rather than redirect() so the surface
  // does not advertise its own existence when it is switched off.
  if (!platformAdminEnabled()) notFound();

  // Second gate: exact-email allowlist. Non-allowlisted users bounce to their
  // dashboard rather than 404, because for them the page does exist.
  if (!(await isPlatformAdmin())) redirect("/dashboard");

  const viewer = await getViewer();

  return (
    <ViewerProvider viewer={viewer}>
      <div className="bg-system flex min-h-screen w-full bg-background">
        <PlatformSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
      <HelpLauncher />
    </ViewerProvider>
  );
}
