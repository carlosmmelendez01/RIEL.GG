-- Durable fixed-window rate limits for anonymous mutation endpoints.
-- Identifiers are HMACed in the application; this table never stores a raw
-- client IP or email address.

CREATE TABLE "PublicRateLimitBucket" (
    "action" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PublicRateLimitBucket_pkey"
      PRIMARY KEY ("action", "keyHash", "windowStart"),
    CONSTRAINT "PublicRateLimitBucket_count_positive_check"
      CHECK ("count" > 0)
);

CREATE INDEX "PublicRateLimitBucket_expiresAt_idx"
ON "PublicRateLimitBucket"("expiresAt");

-- Prisma's server-only database role owns this table. Supabase client roles
-- remain deny-by-default, consistent with the rest of the application schema.
ALTER TABLE "PublicRateLimitBucket" ENABLE ROW LEVEL SECURITY;
