"use client";

/**
 * Floating bottom-right help affordance — wraps ReportIssueButton with
 * positioning + a styled "shield" so it never gets lost in the layout.
 *
 * Mount once per authenticated layout. The button uses the current pathname
 * as the report context so submissions tell us exactly where the user was
 * stuck without them having to remember.
 */

import { usePathname } from "next/navigation";

import { ReportIssueButton } from "@/components/support/report-issue-button";

export function HelpLauncher() {
  const pathname = usePathname();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto rounded-full border border-border/60 bg-card/95 p-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur">
        <ReportIssueButton
          context={{ route: pathname ?? "/" }}
          variant="primary"
          label="Feedback"
        />
      </div>
    </div>
  );
}
