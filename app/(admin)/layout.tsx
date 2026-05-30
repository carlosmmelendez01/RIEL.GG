import type { Metadata } from "next";

import { AdminSidebar } from "@/components/admin/sidebar";
import { ViewerProvider } from "@/components/auth/viewer-provider";
import { HelpLauncher } from "@/components/support/help-launcher";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · RIEL.GG Admin" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
