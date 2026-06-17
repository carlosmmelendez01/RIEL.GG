-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('LEAGUE_OPERATOR', 'SCHOOL_PARTICIPATION');

-- CreateEnum
CREATE TYPE "AgreementCoverageSource" AS ENUM ('DIRECT_SCHOOL_AUTHORIZATION', 'LEAGUE_MASTER_AGREEMENT', 'PARENT_GUARDIAN_REQUIRED');

-- CreateTable
CREATE TABLE "AgreementAcceptance" (
    "id" TEXT NOT NULL,
    "type" "AgreementType" NOT NULL,
    "version" TEXT NOT NULL,
    "leagueId" TEXT,
    "schoolId" TEXT,
    "acceptedById" TEXT,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "coverageSource" "AgreementCoverageSource",
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "attestations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "AgreementAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgreementAcceptance_leagueId_type_version_createdAt_idx" ON "AgreementAcceptance"("leagueId", "type", "version", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementAcceptance_schoolId_type_version_createdAt_idx" ON "AgreementAcceptance"("schoolId", "type", "version", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementAcceptance_acceptedById_createdAt_idx" ON "AgreementAcceptance"("acceptedById", "createdAt");

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
