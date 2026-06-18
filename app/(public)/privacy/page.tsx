import type { Metadata } from "next";

import { LegalSection as Section, LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "ArcLight student privacy, FERPA, and COPPA posture.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" eyebrow="Student privacy" updated="June 16, 2026">
      <Section title="Beta notice">
        <p>
          This policy is a beta compliance draft for school review and legal counsel. ArcLight
          is designed as a school-controlled esports competition service for leagues, schools,
          coaches, and students.
        </p>
      </Section>
      <Section title="Data we collect">
        <p>
          We collect account identity, school/team/roster membership, in-game handles,
          match schedules, check-ins, scores, forfeits, match reports, limited match chat,
          invite activity, agreement acceptance records, support feedback, and audit logs.
        </p>
      </Section>
      <Section title="Student data use">
        <p>
          Student data is used only to operate school esports competitions, verify roster
          eligibility, run match operations, maintain standings, support school administration,
          and satisfy audit or safety obligations.
        </p>
      </Section>
      <Section title="FERPA / COPPA posture">
        <p>
          When ArcLight is used by a school, student records are handled under the school&apos;s
          direction. For under-13 students, ArcLight requires school authorization or parent /
          guardian consent before player surfaces and match participation actions are enabled.
        </p>
      </Section>
      <Section title="No ads or sale of student data">
        <p>
          ArcLight does not sell student data, run behavioral advertising, or build commercial
          advertising profiles from student activity.
        </p>
      </Section>
      <Section title="Retention and deletion">
        <p>
          Schools may request exports or deletion review from the school dashboard. Some records
          may be retained when needed for league integrity, audit trails, dispute resolution,
          security, or legal obligations.
        </p>
      </Section>
      <Section title="Contact">
        <p>
          Schools and parents can route privacy questions through their school administrator or
          league operator while ArcLight is in beta.
        </p>
      </Section>
    </LegalShell>
  );
}
