import type { Metadata } from "next";

import { LegalSection as Section, LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "School Data Privacy Addendum",
  description: "ArcLight beta school data privacy addendum template.",
};

export default function DpaPage() {
  return (
    <LegalShell
      title="School Data Privacy Addendum"
      eyebrow="FERPA / COPPA draft"
      updated="June 16, 2026"
    >
      <Section title="Status">
        <p>
          This is a practical DPA template for beta review. A school or league should have counsel
          review and execute a final agreement before production use with real student data.
        </p>
      </Section>
      <Section title="Purpose">
        <p>
          ArcLight processes student data only to provide school esports league operations,
          including roster management, scheduling, match operations, score reporting, standings,
          support, security, and audit logs.
        </p>
      </Section>
      <Section title="School official / service provider">
        <p>
          ArcLight acts under the school or league&apos;s direction for authorized educational use.
          ArcLight does not own student records and will not redisclose them except to approved
          subprocessors or as legally required.
        </p>
      </Section>
      <Section title="Authorization record">
        <p>
          ArcLight records league and school agreement acceptances by agreement version. School
          records may indicate direct school authorization, coverage under a league master
          agreement, or a school requirement for parent/guardian consent.
        </p>
      </Section>
      <Section title="COPPA school consent">
        <p>
          For under-13 students, the school may authorize use only when the service is used for
          school purposes and not for unrelated commercial activity. Schools may also require
          parent or guardian consent.
        </p>
      </Section>
      <Section title="Subprocessors">
        <p>
          Current beta subprocessors include Supabase for database/auth/storage, Vercel for
          hosting/deployment, and Resend for transactional email. Additional subprocessors should
          be documented before use.
        </p>
      </Section>
      <Section title="Security">
        <p>
          ArcLight uses role-scoped access, school/league tenancy checks, audit logs, authenticated
          routes, and limited student data collection. Production use should include monitoring,
          rate limiting, backup review, and incident response procedures.
        </p>
      </Section>
      <Section title="Access, export, deletion">
        <p>
          School managers can request or download scoped student exports and open deletion review
          requests from the school dashboard. Deletion may require league review where records are
          needed for competition integrity, disputes, audit, or legal obligations.
        </p>
      </Section>
    </LegalShell>
  );
}
