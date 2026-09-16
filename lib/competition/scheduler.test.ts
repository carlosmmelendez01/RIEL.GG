import { describe, expect, it } from "vitest";

import { buildRoundRobinPairings, buildRoundSchedule } from "./scheduler";

function pairKey(pair: [string, string]): string {
  return [...pair].sort().join(":");
}

function flattenPairs(rounds: ReturnType<typeof buildRoundRobinPairings>): [string, string][] {
  return rounds.flatMap((round) => round.filter((pair): pair is [string, string] => pair !== null));
}

describe("buildRoundRobinPairings", () => {
  it("creates every matchup exactly once for an even team count", () => {
    const rounds = buildRoundRobinPairings(["a", "b", "c", "d"]);
    const pairs = flattenPairs(rounds).map(pairKey);

    expect(rounds).toHaveLength(3);
    expect(rounds.every((round) => round.length === 2)).toBe(true);
    expect(new Set(pairs)).toEqual(
      new Set(["a:b", "a:c", "a:d", "b:c", "b:d", "c:d"]),
    );
  });

  it("assigns one bye per team for an odd team count", () => {
    const teams = ["a", "b", "c", "d", "e"];
    const rounds = buildRoundRobinPairings(teams);
    const byes = new Map(teams.map((team) => [team, 0]));
    const pairs = flattenPairs(rounds).map(pairKey);

    for (const round of rounds) {
      const activeTeams = new Set(flattenPairs([round]).flat());
      const restingTeams = teams.filter((team) => !activeTeams.has(team));
      expect(restingTeams).toHaveLength(1);
      byes.set(restingTeams[0], (byes.get(restingTeams[0]) ?? 0) + 1);
    }

    expect(rounds).toHaveLength(5);
    expect(new Set(pairs)).toHaveLength(10);
    expect([...byes.values()]).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("buildRoundSchedule", () => {
  it("uses weekly round windows when the stage is long enough", () => {
    const schedule = buildRoundSchedule({
      stageStartsAt: new Date("2026-01-01T15:00:00.000Z"),
      stageEndsAt: new Date("2026-02-28T15:00:00.000Z"),
      roundCount: 3,
    });

    expect(schedule.map((round) => round.startsAt.toISOString())).toEqual([
      "2026-01-01T15:00:00.000Z",
      "2026-01-08T15:00:00.000Z",
      "2026-01-15T15:00:00.000Z",
    ]);
    expect(schedule.map((round) => round.cadence)).toEqual(["WEEKLY", "WEEKLY", "WEEKLY"]);
  });

  it("compresses round windows inside short stages", () => {
    const stageStartsAt = new Date("2026-01-01T00:00:00.000Z");
    const stageEndsAt = new Date("2026-01-05T00:00:00.000Z");
    const schedule = buildRoundSchedule({ stageStartsAt, stageEndsAt, roundCount: 5 });

    expect(schedule).toHaveLength(5);
    expect(schedule[0].startsAt).toEqual(stageStartsAt);
    expect(schedule.at(-1)?.endsAt).toEqual(stageEndsAt);
    expect(schedule.map((round) => round.cadence)).toEqual([
      "COMPRESSED",
      "COMPRESSED",
      "COMPRESSED",
      "COMPRESSED",
      "COMPRESSED",
    ]);

    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].startsAt.getTime()).toBeGreaterThan(schedule[i - 1].startsAt.getTime());
      expect(schedule[i].endsAt.getTime()).toBeLessThanOrEqual(stageEndsAt.getTime());
    }
  });
});
