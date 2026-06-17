-- CreateEnum
CREATE TYPE "LeagueResourceCategory" AS ENUM ('GENERAL_RULES', 'GAME_RULES', 'MATCH_DAY', 'LOBBY_SETUP', 'ELIGIBILITY', 'COMPLIANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "LeagueResourceAudience" AS ENUM ('ALL', 'COACHES', 'PLAYERS', 'STAFF');

-- CreateTable
CREATE TABLE "LeagueResource" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "category" "LeagueResourceCategory" NOT NULL DEFAULT 'GENERAL_RULES',
    "audience" "LeagueResourceAudience" NOT NULL DEFAULT 'ALL',
    "gameTitleId" TEXT,
    "seasonId" TEXT,
    "competitionId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueResource_leagueId_published_pinned_updatedAt_idx" ON "LeagueResource"("leagueId", "published", "pinned", "updatedAt");

-- CreateIndex
CREATE INDEX "LeagueResource_leagueId_category_idx" ON "LeagueResource"("leagueId", "category");

-- CreateIndex
CREATE INDEX "LeagueResource_leagueId_gameTitleId_idx" ON "LeagueResource"("leagueId", "gameTitleId");

-- CreateIndex
CREATE INDEX "LeagueResource_seasonId_idx" ON "LeagueResource"("seasonId");

-- CreateIndex
CREATE INDEX "LeagueResource_competitionId_idx" ON "LeagueResource"("competitionId");

-- AddForeignKey
ALTER TABLE "LeagueResource" ADD CONSTRAINT "LeagueResource_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueResource" ADD CONSTRAINT "LeagueResource_gameTitleId_fkey" FOREIGN KEY ("gameTitleId") REFERENCES "GameTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueResource" ADD CONSTRAINT "LeagueResource_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueResource" ADD CONSTRAINT "LeagueResource_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueResource" ADD CONSTRAINT "LeagueResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueResource" ADD CONSTRAINT "LeagueResource_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
