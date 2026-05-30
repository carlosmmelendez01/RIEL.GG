// Sanity check: verify Prisma connects + every table is reachable.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tables = [
  "user",
  "league",
  "leagueAdminship",
  "leagueMembership",
  "school",
  "schoolMembership",
  "invite",
  "gameTitle",
  "gameFormat",
  "team",
  "teamMembership",
  "season",
  "competition",
  "stage",
  "round",
  "registrationModule",
  "roster",
  "rosterMembership",
  "rosterModuleStatus",
  "match",
  "game",
  "gameAppearance",
  "matchReport",
  "matchReportEvidence",
  "matchMessage",
  "stageStanding",
  "announcement",
  "auditLog",
];

console.log("Probing all tables…\n");
let allOk = true;
for (const t of tables) {
  try {
    const count = await prisma[t].count();
    console.log(`  ✓ ${t.padEnd(28)} ${count} rows`);
  } catch (e) {
    console.log(`  ✗ ${t.padEnd(28)} ${e.message.slice(0, 80)}`);
    allOk = false;
  }
}

await prisma.$disconnect();
console.log(allOk ? "\n✓ Connection OK — all 28 tables reachable." : "\n✗ Some tables failed.");
process.exit(allOk ? 0 : 1);
