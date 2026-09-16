-- RIEL 2.0 phase 2: data-driven division classification.
--
-- Additive. Legacy League.schoolDivisions and LeagueMembership.division columns
-- remain in the database for compatibility/backfill, but new code reads
-- Division, DivisionRule, and SeasonSchoolClassification.

-- CreateEnum
CREATE TYPE "ClassificationStatus" AS ENUM (
  'CLASSIFIED',
  'NO_DIVISION',
  'MISSING_SCHOOL_LEVEL',
  'MISSING_ENROLLMENT',
  'ENROLLMENT_SCOPE_MISMATCH',
  'NO_RULE_MATCH',
  'AMBIGUOUS_RULES'
);

CREATE TYPE "ClassificationMethod" AS ENUM (
  'RULE',
  'NO_DIVISION',
  'ADMIN_OVERRIDE',
  'UNCLASSIFIED'
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionRule" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "divisionId" TEXT,
    "schoolLevel" "SchoolLevel" NOT NULL,
    "enrollmentScope" "EnrollmentScope" NOT NULL DEFAULT 'GRADES_9_12',
    "minimumEnrollment" INTEGER,
    "maximumEnrollment" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DivisionRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DivisionRule_enrollment_bounds_check" CHECK (
      "minimumEnrollment" IS NULL
      OR "maximumEnrollment" IS NULL
      OR "minimumEnrollment" <= "maximumEnrollment"
    ),
    CONSTRAINT "DivisionRule_effective_window_check" CHECK (
      "effectiveUntil" IS NULL OR "effectiveFrom" < "effectiveUntil"
    )
);

-- CreateTable
CREATE TABLE "SeasonSchoolClassification" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "ClassificationStatus" NOT NULL,
    "method" "ClassificationMethod" NOT NULL DEFAULT 'RULE',
    "calculatedDivisionId" TEXT,
    "effectiveDivisionId" TEXT,
    "ruleId" TEXT,
    "enrollmentId" TEXT,
    "explanation" TEXT NOT NULL,
    "overrideReason" TEXT,
    "reviewNeeded" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonSchoolClassification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Division_leagueId_name_key" ON "Division"("leagueId", "name");

-- CreateIndex
CREATE INDEX "Division_leagueId_sortOrder_idx" ON "Division"("leagueId", "sortOrder");

-- CreateIndex
CREATE INDEX "Division_leagueId_active_idx" ON "Division"("leagueId", "active");

-- CreateIndex
CREATE INDEX "DivisionRule_leagueId_schoolLevel_enrollmentScope_idx" ON "DivisionRule"("leagueId", "schoolLevel", "enrollmentScope");

-- CreateIndex
CREATE INDEX "DivisionRule_divisionId_idx" ON "DivisionRule"("divisionId");

-- CreateIndex
CREATE INDEX "DivisionRule_effectiveFrom_effectiveUntil_idx" ON "DivisionRule"("effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonSchoolClassification_seasonId_schoolId_key" ON "SeasonSchoolClassification"("seasonId", "schoolId");

-- CreateIndex
CREATE INDEX "SeasonSchoolClassification_seasonId_effectiveDivisionId_idx" ON "SeasonSchoolClassification"("seasonId", "effectiveDivisionId");

-- CreateIndex
CREATE INDEX "SeasonSchoolClassification_seasonId_status_idx" ON "SeasonSchoolClassification"("seasonId", "status");

-- CreateIndex
CREATE INDEX "SeasonSchoolClassification_schoolId_idx" ON "SeasonSchoolClassification"("schoolId");

-- CreateIndex
CREATE INDEX "SeasonSchoolClassification_reviewNeeded_updatedAt_idx" ON "SeasonSchoolClassification"("reviewNeeded", "updatedAt");

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionRule" ADD CONSTRAINT "DivisionRule_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionRule" ADD CONSTRAINT "DivisionRule_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonSchoolClassification" ADD CONSTRAINT "SeasonSchoolClassification_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonSchoolClassification" ADD CONSTRAINT "SeasonSchoolClassification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonSchoolClassification" ADD CONSTRAINT "SeasonSchoolClassification_calculatedDivisionId_fkey" FOREIGN KEY ("calculatedDivisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonSchoolClassification" ADD CONSTRAINT "SeasonSchoolClassification_effectiveDivisionId_fkey" FOREIGN KEY ("effectiveDivisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonSchoolClassification" ADD CONSTRAINT "SeasonSchoolClassification_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DivisionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonSchoolClassification" ADD CONSTRAINT "SeasonSchoolClassification_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SchoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonSchoolClassification" ADD CONSTRAINT "SeasonSchoolClassification_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: new application tables are deny-by-default until app
-- policies are deliberately opened.
ALTER TABLE "Division" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DivisionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeasonSchoolClassification" ENABLE ROW LEVEL SECURITY;
