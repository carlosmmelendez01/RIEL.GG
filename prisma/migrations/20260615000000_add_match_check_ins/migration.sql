-- CreateTable
CREATE TABLE "MatchCheckIn" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "rosterMembershipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "MatchSide" NOT NULL,
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchCheckIn_matchId_rosterMembershipId_key" ON "MatchCheckIn"("matchId", "rosterMembershipId");

-- CreateIndex
CREATE INDEX "MatchCheckIn_matchId_side_idx" ON "MatchCheckIn"("matchId", "side");

-- CreateIndex
CREATE INDEX "MatchCheckIn_rosterId_idx" ON "MatchCheckIn"("rosterId");

-- CreateIndex
CREATE INDEX "MatchCheckIn_userId_idx" ON "MatchCheckIn"("userId");

-- AddForeignKey
ALTER TABLE "MatchCheckIn" ADD CONSTRAINT "MatchCheckIn_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCheckIn" ADD CONSTRAINT "MatchCheckIn_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCheckIn" ADD CONSTRAINT "MatchCheckIn_rosterMembershipId_fkey" FOREIGN KEY ("rosterMembershipId") REFERENCES "RosterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCheckIn" ADD CONSTRAINT "MatchCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCheckIn" ADD CONSTRAINT "MatchCheckIn_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
