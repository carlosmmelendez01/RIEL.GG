import { describe, expect, it } from "vitest";

import {
  consumePublicRateLimit,
  enforceBetaGateRateLimit,
  enforceJoinRateLimit,
  fixedWindow,
  rateLimitKeyHash,
  readClientIp,
  type RateLimitBucketStore,
} from "@/lib/security/public-rate-limit";

class MemoryBucketStore implements RateLimitBucketStore {
  readonly counts = new Map<string, number>();
  readonly inputs: Array<{
    action: string;
    keyHash: string;
    windowStart: Date;
    expiresAt: Date;
  }> = [];
  cleanupCalls = 0;

  async increment(input: {
    action: string;
    keyHash: string;
    windowStart: Date;
    expiresAt: Date;
  }): Promise<{ count: number }> {
    this.inputs.push(input);
    const key = `${input.action}:${input.keyHash}:${input.windowStart.toISOString()}`;
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { count };
  }

  async deleteExpired(): Promise<void> {
    this.cleanupCalls += 1;
  }
}

function headerReader(values: Record<string, string | null>): Pick<Headers, "get"> {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe("public rate limiting", () => {
  it("uses deterministic fixed windows", () => {
    const window = fixedWindow(new Date("2026-09-18T15:47:12.345Z"), 60 * 60 * 1000);
    expect(window.start.toISOString()).toBe("2026-09-18T15:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-18T16:00:00.000Z");
  });

  it("HMACs identifiers instead of storing them", () => {
    const hash = rateLimitKeyHash("school-application:ip", "203.0.113.12", "x".repeat(32));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("203.0.113.12");
    expect(hash).toBe(
      rateLimitKeyHash("school-application:ip", "203.0.113.12", "x".repeat(32)),
    );
    expect(hash).not.toBe(
      rateLimitKeyHash("school-application:email", "203.0.113.12", "x".repeat(32)),
    );
  });

  it("atomically counts through the limit and resets in a new window", async () => {
    const store = new MemoryBucketStore();
    const rule = {
      action: "test",
      identifier: "person@example.com",
      limit: 2,
      windowMs: 60_000,
    };
    const options = {
      store,
      secret: "s".repeat(32),
      now: new Date("2026-09-18T15:00:30.000Z"),
    };

    await expect(consumePublicRateLimit(rule, options)).resolves.toMatchObject({
      allowed: true,
      count: 1,
    });
    await expect(consumePublicRateLimit(rule, options)).resolves.toMatchObject({
      allowed: true,
      count: 2,
    });
    await expect(consumePublicRateLimit(rule, options)).resolves.toMatchObject({
      allowed: false,
      count: 3,
    });
    await expect(
      consumePublicRateLimit(rule, {
        ...options,
        now: new Date("2026-09-18T15:01:00.000Z"),
      }),
    ).resolves.toMatchObject({ allowed: true, count: 1 });
  });

  it("takes the first valid proxy address and supports common port forms", () => {
    expect(
      readClientIp(
        headerReader({
          "x-forwarded-for": "not-an-ip, 203.0.113.9, 198.51.100.4",
        }),
      ),
    ).toBe("203.0.113.9");
    expect(readClientIp(headerReader({ "x-real-ip": "192.0.2.8:443" }))).toBe("192.0.2.8");
    expect(readClientIp(headerReader({ "cf-connecting-ip": "[2001:db8::1]:443" }))).toBe(
      "2001:db8::1",
    );
  });

  it("enforces the IP limit before the email limit and cleans expired buckets", async () => {
    const store = new MemoryBucketStore();
    const headers = headerReader({ "x-forwarded-for": "203.0.113.25" });
    const options = {
      store,
      secret: "s".repeat(32),
      now: new Date("2026-09-18T15:20:00.000Z"),
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await enforceJoinRateLimit(`coach-${attempt}@example.com`, headers, options);
    }
    await enforceJoinRateLimit("coach-3@example.com", headers, options);
    await enforceJoinRateLimit("coach-4@example.com", headers, options);
    const blocked = await enforceJoinRateLimit("coach-5@example.com", headers, options);

    expect(blocked).toMatchObject({ allowed: false, count: 6, limit: 5 });
    expect(store.cleanupCalls).toBe(6);
    expect(store.inputs.filter((input) => input.action.endsWith(":email"))).toHaveLength(5);
  });

  it("still rate-limits normalized email when no client IP is available", async () => {
    const store = new MemoryBucketStore();
    const options = {
      store,
      secret: "s".repeat(32),
      now: new Date("2026-09-18T15:20:00.000Z"),
    };

    await expect(
      enforceJoinRateLimit(" Coach@Example.COM ", headerReader({}), options),
    ).resolves.toBeNull();
    await enforceJoinRateLimit("coach@example.com", headerReader({}), options);
    await enforceJoinRateLimit("coach@example.com", headerReader({}), options);
    await expect(
      enforceJoinRateLimit("coach@example.com", headerReader({}), options),
    ).resolves.toMatchObject({ allowed: false, count: 4, limit: 3 });
  });

  it("blocks the eleventh beta-password attempt in a 15-minute window", async () => {
    const store = new MemoryBucketStore();
    const headers = headerReader({ "x-forwarded-for": "198.51.100.17" });
    const options = {
      store,
      secret: "s".repeat(32),
      now: new Date("2026-09-18T15:20:00.000Z"),
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(enforceBetaGateRateLimit(headers, options)).resolves.toBeNull();
    }
    await expect(enforceBetaGateRateLimit(headers, options)).resolves.toMatchObject({
      allowed: false,
      count: 11,
      limit: 10,
      retryAt: new Date("2026-09-18T15:30:00.000Z"),
    });
  });

  it("does not share a fallback beta-gate bucket when no proxy IP exists", async () => {
    const store = new MemoryBucketStore();
    await expect(
      enforceBetaGateRateLimit(headerReader({}), {
        store,
        secret: "s".repeat(32),
      }),
    ).resolves.toBeNull();
    expect(store.inputs).toHaveLength(0);
    expect(store.cleanupCalls).toBe(0);
  });
});
