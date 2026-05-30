-- CreateEnum
CREATE TYPE "PlayerCommentVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'RECRUITER');

-- CreateEnum
CREATE TYPE "PlayerCommentKind" AS ENUM ('COACH', 'AI', 'RECRUITER');

-- CreateEnum
CREATE TYPE "PlayerGoalKind" AS ENUM ('WINS', 'WIN_RATE', 'ATTENDANCE_RATE', 'MATCHES_PLAYED', 'WIN_STREAK');

-- CreateTable
CREATE TABLE "PlayerComment" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "authorId" TEXT,
    "matchId" TEXT,
    "kind" "PlayerCommentKind" NOT NULL DEFAULT 'COACH',
    "visibility" "PlayerCommentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGoal" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" "PlayerGoalKind" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "seasonId" TEXT,
    "achievedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerComment_playerId_createdAt_idx" ON "PlayerComment"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerComment_authorId_idx" ON "PlayerComment"("authorId");

-- CreateIndex
CREATE INDEX "PlayerComment_matchId_idx" ON "PlayerComment"("matchId");

-- CreateIndex
CREATE INDEX "PlayerGoal_playerId_achievedAt_idx" ON "PlayerGoal"("playerId", "achievedAt");

-- CreateIndex
CREATE INDEX "PlayerGoal_seasonId_idx" ON "PlayerGoal"("seasonId");

-- AddForeignKey
ALTER TABLE "PlayerComment" ADD CONSTRAINT "PlayerComment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerComment" ADD CONSTRAINT "PlayerComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerComment" ADD CONSTRAINT "PlayerComment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGoal" ADD CONSTRAINT "PlayerGoal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGoal" ADD CONSTRAINT "PlayerGoal_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
