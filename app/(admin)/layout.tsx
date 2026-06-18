import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/sidebar";
import { ViewerProvider } from "@/components/auth/viewer-provider";
import { HelpLauncher } from "@/components/support/help-launcher";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getViewer } from "@/lib/auth/viewer";
import { findPendingLeagueAgreement } from "@/lib/compliance/agreements";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · ArcLight Admin" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) {
    const pendingAgreement = await findPendingLeagueAgreement(user.id);
    if (pendingAgreement) {
      redirect(`/agreements/league/${pendingAgreement.leagueId}`);
    }
  }

  const viewer = await getViewer();

  return (
    <ViewerProvider viewer={viewer}>
      <div className="bg-system flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
      <HelpLauncher />
    </ViewerProvider>
  );
}
