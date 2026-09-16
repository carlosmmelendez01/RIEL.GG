// Sanity check: verify Prisma connects + every model table is reachable.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) process.loadEnvFile(path);
}

const { Prisma, PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const tables = Prisma.dmmf.datamodel.models
  .map((model) => model.name[0].toLowerCase() + model.name.slice(1))
  .sort((a, b) => a.localeCompare(b));

console.log(`Probing ${tables.length} Prisma models…`);
console.log(`Database: ${describeDatabase(process.env.DATABASE_URL)}\n`);
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
console.log(
  allOk
    ? `\n✓ Connection OK — all ${tables.length} Prisma models reachable.`
    : "\n✗ Some tables failed.",
);
process.exit(allOk ? 0 : 1);

function describeDatabase(rawUrl) {
  if (!rawUrl) return "DATABASE_URL unset";
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "DATABASE_URL is not parseable";
  }
}
