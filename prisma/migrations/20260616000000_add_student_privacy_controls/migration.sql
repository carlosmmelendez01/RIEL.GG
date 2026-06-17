-- CreateEnum
CREATE TYPE "StudentAgeBand" AS ENUM ('UNKNOWN', 'UNDER_13', 'AGE_13_TO_17', 'AGE_18_PLUS');

-- CreateEnum
CREATE TYPE "StudentConsentStatus" AS ENUM ('PENDING', 'SCHOOL_AUTHORIZED', 'PARENT_AUTHORIZED', 'NOT_REQUIRED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StudentDataRequestType" AS ENUM ('EXPORT', 'DELETE');

-- CreateEnum
CREATE TYPE "StudentDataRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "StudentConsent" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "StudentConsentStatus" NOT NULL DEFAULT 'PENDING',
    "ageBand" "StudentAgeBand" NOT NULL DEFAULT 'UNKNOWN',
    "basis" TEXT,
    "recorderUserId" TEXT,
    "recorderName" TEXT,
    "notes" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDataRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "requestedById" TEXT,
    "type" "StudentDataRequestType" NOT NULL,
    "status" "StudentDataRequestStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentConsent_studentUserId_schoolId_key" ON "StudentConsent"("studentUserId", "schoolId");

-- CreateIndex
CREATE INDEX "StudentConsent_schoolId_status_idx" ON "StudentConsent"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StudentConsent_studentUserId_status_idx" ON "StudentConsent"("studentUserId", "status");

-- CreateIndex
CREATE INDEX "StudentDataRequest_schoolId_status_createdAt_idx" ON "StudentDataRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentDataRequest_subjectUserId_createdAt_idx" ON "StudentDataRequest"("subjectUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentConsent" ADD CONSTRAINT "StudentConsent_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentConsent" ADD CONSTRAINT "StudentConsent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentConsent" ADD CONSTRAINT "StudentConsent_recorderUserId_fkey" FOREIGN KEY ("recorderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDataRequest" ADD CONSTRAINT "StudentDataRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDataRequest" ADD CONSTRAINT "StudentDataRequest_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDataRequest" ADD CONSTRAINT "StudentDataRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
