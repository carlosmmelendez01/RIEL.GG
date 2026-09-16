export type RoundPairing = [string, string] | null;

export type RoundScheduleWindow = {
  startsAt: Date;
  endsAt: Date;
  cadence: "WEEKLY" | "COMPRESSED";
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Circle method: returns N-1 rounds of pairings. For odd team counts, one
 * pairing per round is `null`, representing the bye.
 */
export function buildRoundRobinPairings(rosterIds: readonly string[]): RoundPairing[][] {
  const teams = [...rosterIds];
  if (teams.length % 2 === 1) teams.push("__BYE__");
  const n = teams.length;
  const roundsCount = n - 1;
  const half = n / 2;

  const rounds: RoundPairing[][] = [];
  const arr = [...teams];

  for (let r = 0; r < roundsCount; r++) {
    const pairings: RoundPairing[] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === "__BYE__" || b === "__BYE__") {
        pairings.push(null);
      } else if (r % 2 === 0) {
        pairings.push([a, b]);
      } else {
        pairings.push([b, a]);
      }
    }
    rounds.push(pairings);

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string);
    arr.length = 0;
    arr.push(fixed, ...rest);
  }

  return rounds;
}

export function buildRoundSchedule(input: {
  stageStartsAt: Date;
  stageEndsAt: Date;
  roundCount: number;
}): RoundScheduleWindow[] {
  const { stageStartsAt, stageEndsAt, roundCount } = input;
  if (!Number.isInteger(roundCount) || roundCount < 1) return [];

  const startMs = stageStartsAt.getTime();
  const endMs = stageEndsAt.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return Array.from({ length: roundCount }, (_, index) =>
      roundWindow(startMs + index * WEEK_MS, DAY_MS, "WEEKLY"),
    );
  }

  const stageSpanMs = endMs - startMs;
  const roundDurationMs = Math.min(DAY_MS, stageSpanMs);
  const weeklyLastRoundEndMs = startMs + (roundCount - 1) * WEEK_MS + roundDurationMs;

  if (weeklyLastRoundEndMs <= endMs) {
    return Array.from({ length: roundCount }, (_, index) =>
      roundWindow(startMs + index * WEEK_MS, roundDurationMs, "WEEKLY"),
    );
  }

  if (roundCount === 1) {
    return [roundWindow(startMs, roundDurationMs, "COMPRESSED")];
  }

  const latestStartMs = Math.max(startMs, endMs - roundDurationMs);
  const spacingMs = (latestStartMs - startMs) / (roundCount - 1);

  return Array.from({ length: roundCount }, (_, index) =>
    roundWindow(startMs + Math.round(index * spacingMs), roundDurationMs, "COMPRESSED"),
  );
}

function roundWindow(
  startsAtMs: number,
  durationMs: number,
  cadence: RoundScheduleWindow["cadence"],
): RoundScheduleWindow {
  const startsAt = new Date(startsAtMs);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMs),
    cadence,
  };
}
