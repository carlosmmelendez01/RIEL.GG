import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const now = new Date();
const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const upcoming = await p.match.count({
  where: { scheduledAt: { gte: now, lte: in30d } },
});
const live = await p.match.count({
  where: { status: { in: ['IN_PROGRESS', 'CHECKING_IN', 'AWAITING_CONFIRMATION'] } },
});
const scheduled = await p.match.count({ where: { status: 'SCHEDULED' } });
const nearest = await p.match.findFirst({
  where: { scheduledAt: { gte: now } },
  orderBy: { scheduledAt: 'asc' },
  select: { id: true, scheduledAt: true, status: true },
});
console.log(JSON.stringify({ upcoming, live, scheduled, nearest }, null, 2));
await p.$disconnect();
