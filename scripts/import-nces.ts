import { prisma } from "../lib/db/prisma";
import { importNcesCcd, ZipCsvCcdRowReader } from "../lib/nces/importer";
import { PrismaNcesImportStore } from "../lib/nces/prisma-store";

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

async function main() {
  const force = hasFlag("--force");
  const result = await importNcesCcd({
    store: new PrismaNcesImportStore(prisma),
    rowReader: new ZipCsvCcdRowReader(),
    force,
  });

  console.log(`NCES CCD import ${result.status}: ${result.release.release}`);
  console.log(`  schools seen:    ${result.schoolsSeen}`);
  console.log(`  schools created: ${result.schoolsCreated}`);
  console.log(`  schools updated: ${result.schoolsUpdated}`);
  console.log(`  enrollment rows: ${result.enrollmentRows}`);
  console.log(`  row errors:      ${result.errorCount}`);
  if (result.errors.length > 0) {
    console.log("\nStored row errors:");
    for (const error of result.errors.slice(0, 10)) {
      const where = [error.phase, error.externalId, error.rowNumber ? `row ${error.rowNumber}` : null]
        .filter(Boolean)
        .join(" ");
      console.log(`  - ${where}: ${error.message}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ...and ${result.errors.length - 10} more stored errors`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
