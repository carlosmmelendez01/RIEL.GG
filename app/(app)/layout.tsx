import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/dashboard/sidebar";
import { ViewerProvider } from "@/components/auth/viewer-provider";
import { HelpLauncher } from "@/components/support/help-launcher";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getViewer } from "@/lib/auth/viewer";
import { findPendingSchoolAgreement } from "@/lib/compliance/agreements";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) {
    const pendingAgreement = await findPendingSchoolAgreement(user.id);
    if (pendingAgreement) {
      redirect(`/agreements/school/${pendingAgreement.schoolId}`);
    }
  }

  const viewer = await getViewer();

  return (
    <ViewerProvider viewer={viewer}>
      <div className="bg-system flex min-h-screen w-full bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
      <HelpLauncher />
    </ViewerProvider>
  );
}
