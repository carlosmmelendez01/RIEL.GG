-- RIEL 2.0 phase 3: competition eligibility fields.
--
-- Additive. Existing competitions remain open to every division and continue
-- approving registrations immediately unless an admin opts into review.

ALTER TABLE "Competition"
ADD COLUMN "divisionId" TEXT,
ADD COLUMN "registrationRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Competition_divisionId_idx" ON "Competition"("divisionId");

ALTER TABLE "Competition"
ADD CONSTRAINT "Competition_divisionId_fkey"
FOREIGN KEY ("divisionId") REFERENCES "Division"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
