-- Store each league's ordered school-division configuration.
-- NULL keeps the built-in defaults; an array, including [], is explicit.
ALTER TABLE "League" ADD COLUMN "schoolDivisions" JSONB;
