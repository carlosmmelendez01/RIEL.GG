import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlatformSidebar } from "@/components/platform/sidebar";
import { ViewerProvider } from "@/components/auth/viewer-provider";
import { HelpLauncher } from "@/components/support/help-launcher";
import { getViewer } from "@/lib/auth/viewer";
import { isPlatformAdmin } from "@/lib/auth/platform";

export const metadata: Metadata = {
  title: { default: "Platform", template: "%s · RIEL.GG Platform" },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // Closed by default — the platform SaaS-admin surface is still mock data and
  // out of scope for the beta. Non-allowlisted users bounce to their dashboard.
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
