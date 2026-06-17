-- Add league-scoped school division labels.
-- A school can belong to multiple leagues, and each league can use a different
-- division system, so this belongs on LeagueMembership rather than School.
ALTER TABLE "LeagueMembership" ADD COLUMN "division" TEXT;
