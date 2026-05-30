import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Sample 5 users of different roles
const users = await p.user.findMany({
  take: 8,
  orderBy: { fullName: 'asc' },
  select: {
    id: true,
    fullName: true,
    email: true,
    rosterMemberships: { select: { role: true, roster: { select: { team: { select: { customName: true, school: { select: { shortName: true } } } } } } } },
    schoolMemberships: { select: { role: true } },
    leagueAdminships: { select: { role: true } },
  },
});
for (const u of users) {
  const teamLabels = u.rosterMemberships.map(rm => `${rm.role}@${rm.roster.team.customName ?? rm.roster.team.school.shortName}`).join(', ') || '(none)';
  const schools = u.schoolMemberships.map(sm => sm.role).join(', ') || '(none)';
  const admins = u.leagueAdminships.map(la => la.role).join(', ') || '(none)';
  console.log(`${u.email.padEnd(40)} | rosters: ${teamLabels} | school: ${schools} | league: ${admins}`);
}
await p.$disconnect();
