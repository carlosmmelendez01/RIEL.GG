-- RIEL 2.0 increment 2: school directory identity + enrollment history.
--
-- Additive. `School.ncesId` is retained and backfilled into
-- (directorySource, externalId); it is dropped in a later migration once no
-- reader depends on it.

-- CreateEnum
CREATE TYPE "SchoolDirectorySource" AS ENUM ('CCD', 'PSS', 'MANUAL');
CREATE TYPE "SchoolLevel" AS ENUM ('ELEMENTARY', 'MIDDLE', 'HIGH', 'OTHER');
CREATE TYPE "EnrollmentScope" AS ENUM ('GRADES_9_12', 'TOTAL');
CREATE TYPE "EnrollmentSource" AS ENUM ('NCES_CCD', 'NCES_PSS', 'SCHOOL_REPORTED', 'LEAGUE_ADMIN');
CREATE TYPE "DatasetImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "directorySource" "SchoolDirectorySource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "districtName" TEXT,
ADD COLUMN     "districtExternalId" TEXT,
ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "zip" TEXT,
ADD COLUMN     "level" "SchoolLevel",
ADD COLUMN     "lowGrade" TEXT,
ADD COLUMN     "highGrade" TEXT,
ADD COLUMN     "datasetRelease" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3);

-- AlterTable: "IN" was an IEN assumption baked into the schema.
ALTER TABLE "School" ALTER COLUMN "state" DROP DEFAULT;

-- Backfill: an existing ncesId that looks like a real 12-digit NCES school id
-- becomes a CCD-sourced external id. Anything else stays MANUAL rather than
-- claiming a provenance it does not have.
UPDATE "School"
SET "directorySource" = 'CCD',
    "externalId" = "ncesId"
WHERE "ncesId" IS NOT NULL
  AND "ncesId" ~ '^[0-9]{12}$';

-- CreateTable
CREATE TABLE "SchoolEnrollment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "enrollment" INTEGER NOT NULL,
    "scope" "EnrollmentScope" NOT NULL,
    "source" "EnrollmentSource" NOT NULL,
    "datasetRelease" TEXT,
    "importedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetImport" (
    "id" TEXT NOT NULL,
    "source" "SchoolDirectorySource" NOT NULL,
    "release" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "checksum" TEXT,
    "status" "DatasetImportStatus" NOT NULL DEFAULT 'RUNNING',
    "schoolsSeen" INTEGER NOT NULL DEFAULT 0,
    "schoolsCreated" INTEGER NOT NULL DEFAULT 0,
    "schoolsUpdated" INTEGER NOT NULL DEFAULT 0,
    "enrollmentRows" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DatasetImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_directorySource_externalId_key" ON "School"("directorySource", "externalId");

-- CreateIndex
CREATE INDEX "School_name_idx" ON "School"("name");

-- CreateIndex
CREATE INDEX "School_state_city_idx" ON "School"("state", "city");

-- CreateIndex
CREATE INDEX "School_districtExternalId_idx" ON "School"("districtExternalId");

-- CreateIndex
CREATE INDEX "SchoolEnrollment_schoolId_schoolYear_idx" ON "SchoolEnrollment"("schoolId", "schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolEnrollment_schoolId_schoolYear_source_scope_key" ON "SchoolEnrollment"("schoolId", "schoolYear", "source", "scope");

-- CreateIndex
CREATE INDEX "DatasetImport_status_startedAt_idx" ON "DatasetImport"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetImport_source_release_key" ON "DatasetImport"("source", "release");

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: every application table is deny-by-default, matching
-- 20260617010000_enable_row_level_security. New tables must opt in explicitly
-- or they ship readable by the Supabase anon role.
ALTER TABLE "SchoolEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DatasetImport" ENABLE ROW LEVEL SECURITY;
