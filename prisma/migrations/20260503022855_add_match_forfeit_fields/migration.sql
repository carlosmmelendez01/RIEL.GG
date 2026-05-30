-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "forfeitedAt" TIMESTAMP(3),
ADD COLUMN     "forfeitedById" TEXT,
ADD COLUMN     "isForfeit" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Match_isForfeit_idx" ON "Match"("isForfeit");

-- CreateIndex
CREATE INDEX "Match_isForfeit_forfeitedAt_idx" ON "Match"("isForfeit", "forfeitedAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_forfeitedById_fkey" FOREIGN KEY ("forfeitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
