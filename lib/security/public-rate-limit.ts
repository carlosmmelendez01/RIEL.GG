import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

const JOIN_ACTION = "school-application";
const BETA_GATE_ACTION = "beta-gate";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const JOIN_RATE_LIMITS = {
  ip: { limit: 5, windowMs: HOUR_MS },
  email: { limit: 3, windowMs: DAY_MS },
} as const;

export const BETA_GATE_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
} as const;

type HeaderReader = Pick<Headers, "get">;

export type RateLimitRule = {
  action: string;
  identifier: string;
  limit: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAt: Date;
};

type BucketInput = {
  action: string;
  keyHash: string;
  windowStart: Date;
  expiresAt: Date;
};

export interface RateLimitBucketStore {
  increment(input: BucketInput): Promise<{ count: number }>;
  deleteExpired(now: Date): Promise<void>;
}

const prismaBucketStore: RateLimitBucketStore = {
  async increment(input) {
    return prisma.publicRateLimitBucket.upsert({
      where: {
        action_keyHash_windowStart: {
          action: input.action,
          keyHash: input.keyHash,
          windowStart: input.windowStart,
        },
      },
      update: { count: { increment: 1 } },
      create: {
        action: input.action,
        keyHash: input.keyHash,
        windowStart: input.windowStart,
        expiresAt: input.expiresAt,
      },
      select: { count: true },
    });
  },

  async deleteExpired(now) {
    await prisma.publicRateLimitBucket.deleteMany({
      where: { expiresAt: { lte: now } },
    });
  },
};

function rateLimitSecret(): string {
  const secret = env.RATE_LIMIT_SECRET ?? env.DATABASE_URL;
  if (!secret) {
    throw new Error("RATE_LIMIT_SECRET or DATABASE_URL is required for public rate limiting.");
  }
  return secret;
}

export function rateLimitKeyHash(action: string, identifier: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(action)
    .update("\0")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

export function fixedWindow(now: Date, windowMs: number): { start: Date; end: Date } {
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new Error("Rate-limit windows must be positive whole milliseconds.");
  }
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  return {
    start: new Date(startMs),
    end: new Date(startMs + windowMs),
  };
}

/**
 * Consume one fixed-window counter. The store's increment must be atomic;
 * Prisma delegates this simple upsert to Postgres, whose unique primary key
 * serializes concurrent increments for the same bucket.
 */
export async function consumePublicRateLimit(
  rule: RateLimitRule,
  options: {
    now?: Date;
    secret?: string;
    store?: RateLimitBucketStore;
  } = {},
): Promise<RateLimitDecision> {
  if (!Number.isSafeInteger(rule.limit) || rule.limit <= 0) {
    throw new Error("Rate-limit thresholds must be positive integers.");
  }
  if (!rule.identifier.trim()) {
    throw new Error("A rate-limit identifier is required.");
  }

  const now = options.now ?? new Date();
  const store = options.store ?? prismaBucketStore;
  const window = fixedWindow(now, rule.windowMs);
  const keyHash = rateLimitKeyHash(rule.action, rule.identifier, options.secret ?? rateLimitSecret());
  const bucket = await store.increment({
    action: rule.action,
    keyHash,
    windowStart: window.start,
    expiresAt: window.end,
  });

  return {
    allowed: bucket.count <= rule.limit,
    count: bucket.count,
    limit: rule.limit,
    retryAt: window.end,
  };
}

function normalizeIp(candidate: string | null): string | null {
  if (!candidate) return null;
  const value = candidate.trim().replace(/^"|"$/g, "");
  if (isIP(value)) return value.toLowerCase();

  // Some reverse proxies append a port to an IPv4 address.
  const ipv4WithPort = value.match(/^(.+):(\d+)$/);
  if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) {
    return ipv4WithPort[1];
  }

  // Bracketed IPv6 with an optional port.
  const bracketedIpv6 = value.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6 && isIP(bracketedIpv6[1]) === 6) {
    return bracketedIpv6[1].toLowerCase();
  }
  return null;
}

export function readClientIp(headers: HeaderReader): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  const candidates = [
    ...(forwardedFor?.split(",") ?? []),
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIp(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export async function enforceJoinRateLimit(
  email: string,
  headers: HeaderReader,
  options: {
    now?: Date;
    secret?: string;
    store?: RateLimitBucketStore;
  } = {},
): Promise<RateLimitDecision | null> {
  const now = options.now ?? new Date();
  const store = options.store ?? prismaBucketStore;

  // Cleanup is indexed by expiresAt and deliberately outside either bucket's
  // increment, keeping the hot upsert transaction as short as possible.
  await store.deleteExpired(now);

  const clientIp = readClientIp(headers);
  if (clientIp) {
    const ipDecision = await consumePublicRateLimit(
      {
        action: `${JOIN_ACTION}:ip`,
        identifier: clientIp,
        ...JOIN_RATE_LIMITS.ip,
      },
      { ...options, now, store },
    );
    if (!ipDecision.allowed) return ipDecision;
  }

  const emailDecision = await consumePublicRateLimit(
    {
      action: `${JOIN_ACTION}:email`,
      identifier: email.trim().toLowerCase(),
      ...JOIN_RATE_LIMITS.email,
    },
    { ...options, now, store },
  );
  return emailDecision.allowed ? null : emailDecision;
}

export async function enforceBetaGateRateLimit(
  headers: HeaderReader,
  options: {
    now?: Date;
    secret?: string;
    store?: RateLimitBucketStore;
  } = {},
): Promise<RateLimitDecision | null> {
  const clientIp = readClientIp(headers);
  // Hosting proxies provide a client address. In non-proxied development,
  // avoid putting every visitor into one shared "unknown" bucket.
  if (!clientIp) return null;

  const now = options.now ?? new Date();
  const store = options.store ?? prismaBucketStore;
  await store.deleteExpired(now);

  const decision = await consumePublicRateLimit(
    {
      action: `${BETA_GATE_ACTION}:ip`,
      identifier: clientIp,
      ...BETA_GATE_RATE_LIMIT,
    },
    { ...options, now, store },
  );
  return decision.allowed ? null : decision;
}
