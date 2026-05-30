-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SchoolApplication" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "schoolId" TEXT,
    "schoolName" TEXT NOT NULL,
    "schoolShort" TEXT,
    "schoolCity" TEXT,
    "schoolState" TEXT,
    "schoolCode" TEXT,
    "ncesId" TEXT,
    "coachName" TEXT NOT NULL,
    "coachEmail" TEXT NOT NULL,
    "coachRole" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "resultMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolApplication_leagueId_status_createdAt_idx" ON "SchoolApplication"("leagueId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolApplication_coachEmail_idx" ON "SchoolApplication"("coachEmail");

-- AddForeignKey
ALTER TABLE "SchoolApplication" ADD CONSTRAINT "SchoolApplication_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolApplication" ADD CONSTRAINT "SchoolApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolApplication" ADD CONSTRAINT "SchoolApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
