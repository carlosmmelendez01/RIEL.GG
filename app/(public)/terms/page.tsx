import type { Metadata } from "next";

import { LegalSection as Section, LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "ArcLight beta terms for schools, coaches, league admins, and players.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" eyebrow="Beta terms" updated="June 16, 2026">
      <Section title="Beta notice">
        <p>
          These terms are a working beta draft pending legal review. Access may be limited,
          changed, or removed while ArcLight is tested with schools and leagues.
        </p>
      </Section>
      <Section title="Authorized use">
        <p>
          ArcLight is for school and league esports administration: applications, rosters,
          schedules, match reporting, standings, check-ins, and related communications.
        </p>
      </Section>
      <Section title="School responsibility">
        <p>
          Schools are responsible for deciding which staff and students may use ArcLight,
          maintaining accurate roster data, and recording required consent before student
          participation.
        </p>
      </Section>
      <Section title="Agreement acceptance">
        <p>
          League owners/admins and school managers may be required to accept the current
          agreement version during onboarding before admin tools are available. ArcLight records
          signer details, authority attestations, timestamp, and request metadata for audit.
        </p>
      </Section>
      <Section title="Student conduct">
        <p>
          Users may not harass others, impersonate another person, submit false match results,
          upload harmful content, or use ArcLight outside school-approved competition activity.
        </p>
      </Section>
      <Section title="Data use limits">
        <p>
          ArcLight may use data to operate, secure, audit, support, and improve the school
          competition service. Student data may not be used for advertising or sold.
        </p>
      </Section>
      <Section title="Account security">
        <p>
          Users are responsible for keeping account access secure. School and league admins
          should promptly remove access for people who leave their role.
        </p>
      </Section>
      <Section title="Suspension">
        <p>
          ArcLight or the league operator may suspend accounts, teams, or access when needed for
          safety, security, data protection, competition integrity, or legal compliance.
        </p>
      </Section>
    </LegalShell>
  );
}
