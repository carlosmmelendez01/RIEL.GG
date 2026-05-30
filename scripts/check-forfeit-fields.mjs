import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const ff = await p.match.count({ where: { isForfeit: true } });
const withReason = await p.match.count({ where: { isForfeit: true, forfeitReason: { not: null } } });
const withReschedule = await p.match.count({ where: { isForfeit: true, rescheduleAttempted: { not: null } } });
const rescheduleYes = await p.match.count({ where: { isForfeit: true, rescheduleAttempted: true } });
const byReason = await p.match.groupBy({ by: ['forfeitReason'], where: { isForfeit: true }, _count: { _all: true }, orderBy: { _count: { id: 'desc' } } });
console.log(JSON.stringify({ total: ff, withReason, withReschedule, rescheduleYes, rescheduleRate: ((rescheduleYes / ff) * 100).toFixed(1) + '%', byReason: byReason.map(r => ({ reason: r.forfeitReason, count: r._count._all })) }, null, 2));
await p.$disconnect();
