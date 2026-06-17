# RIEL.GG Student Data Inventory

Last updated: 2026-06-16

This inventory supports FERPA/COPPA review for the beta. It is an engineering inventory, not a final legal agreement.

## Operating posture

RIEL.GG is intended to operate as a school-controlled esports competition service. Schools and leagues invite users, manage rosters, approve participation, report results, and request student data exports or deletion review.

## Student data categories

| Category | Examples | Purpose | Current storage |
| --- | --- | --- | --- |
| Identity | Name, email, avatar URL | Account access, invite matching, roster identity | `User` |
| School membership | School, role, owner flag, detached flag | School access control | `SchoolMembership` |
| Team/roster membership | Team, competition, role, jersey number, in-game name, starter flag | Eligibility, lineups, competition operations | `Team`, `Roster`, `RosterMembership` |
| Match operations | Schedule, side, check-in, scores, forfeits, reports | Match-day execution and standings | `Match`, `MatchCheckIn`, `MatchReport` |
| Match communication | Match messages, system events, evidence paths | Lobby coordination, disputes, audit support | `MatchMessage`, `MatchReportEvidence` |
| Player growth | Goals, coach comments | Coach/player development | `PlayerGoal`, `PlayerComment` |
| Consent/privacy | Age band, consent status, basis, recorder, data requests | FERPA/COPPA gating, access/export/deletion workflow | `StudentConsent`, `StudentDataRequest` |
| Agreement acceptance | Signer name, title, email, authority coverage, attestation metadata, request metadata | School/league authorization evidence and agreement version tracking | `AgreementAcceptance` |
| Audit/security | Actor, action, before/after metadata, entity scopes | Accountability and incident review | `AuditLog` |

## Data intentionally avoided for Gate 1

- Date of birth
- Home address
- Student phone number
- Parent/guardian contact information
- Precise geolocation
- Demographic, disability, disciplinary, medical, or financial aid data
- Public student profile pages
- Advertising identifiers

## Subprocessors

| Provider | Use | Student data involved |
| --- | --- | --- |
| Supabase | Postgres, Auth, Storage | Account, roster, match, evidence, audit data |
| Vercel | Hosting/deployment/runtime | Request metadata and rendered application responses |
| Resend | Transactional email | Recipient email, email content for invites/notifications |

## Access controls

- League admins see league-scoped schools, competitions, matches, applications, and audit context.
- School managers/coaches see school-scoped teams, rosters, schedules, and student compliance posture.
- Students see only their own player page after consent is active.
- Public league pages expose school/team/standing information only, not student identity.

## Gate 1 implementation status

- Policy pages: `/privacy`, `/terms`, `/dpa`
- Student consent model: `StudentConsent`
- Student data request model: `StudentDataRequest`
- League/school agreement model: `AgreementAcceptance`
- Agreement onboarding pages: `/agreements/league/[leagueId]`, `/agreements/school/[schoolId]`
- Student player gate: `/me`
- Match action gate: `checkInForMatch`
- School manager controls: `/dashboard/school`
- Student export route: `/dashboard/school/export/[userId]`

## Remaining legal/operations work

- Counsel-reviewed DPA and privacy policy.
- Parent/guardian verified consent workflow if schools require parent collection in-app.
- Subprocessor change notice process.
- Incident response and breach notification playbook.
- Automated retention/deletion jobs.
- Monitoring and rate-limiting on public endpoints.
