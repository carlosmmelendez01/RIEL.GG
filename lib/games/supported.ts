/**
 * Supported games — the single source of truth for which titles RIEL.GG
 * offers. Every game dropdown, the seed, and create-time validation read
 * from this list. To add/remove a title for the league, edit here.
 *
 * MVP scope: Indiana Esports Network (HS / IHSEN) + middle-school (MS / IMSEN)
 * titles only. League of Legends and anything not on this list are NOT
 * supported and cannot be newly created.
 *
 * Existing `GameTitle.slug` values are preserved so historical competitions
 * and teams keep working — we add new titles and deactivate dropped ones
 * rather than renaming/removing slugs.
 */

export type GameLevel = "HS" | "MS";

export type SupportedGame = {
  /** Stable slug — matches GameTitle.slug. Never change for an existing title. */
  slug: string;
  name: string;
  publisher: string;
  /** Play formats seeded as GameFormat rows. First entry is the default. */
  formats: string[];
  /** Which competition levels this title is approved for. */
  levels: GameLevel[];
};

export const SUPPORTED_GAMES: SupportedGame[] = [
  // --- High School (IHSEN) + shared titles ---
  { slug: "val", name: "Valorant", publisher: "Riot Games", formats: ["5v5"], levels: ["HS"] },
  { slug: "apex", name: "Apex Legends", publisher: "Electronic Arts", formats: ["3v3"], levels: ["HS"] },
  { slug: "ow2", name: "Overwatch 2", publisher: "Blizzard", formats: ["5v5"], levels: ["HS"] },
  { slug: "iracing", name: "iRacing", publisher: "iRacing.com", formats: ["1v1", "Team"], levels: ["HS"] },

  // --- Shared across HS + MS ---
  { slug: "rl", name: "Rocket League", publisher: "Psyonix", formats: ["3v3", "2v2", "1v1"], levels: ["HS", "MS"] },
  { slug: "smash", name: "Super Smash Bros. Ultimate", publisher: "Nintendo", formats: ["1v1", "Crew"], levels: ["HS", "MS"] },
  { slug: "mariokart", name: "Mario Kart 8 Deluxe", publisher: "Nintendo", formats: ["1v1", "Team"], levels: ["HS", "MS"] },
  { slug: "minecraft", name: "Minecraft", publisher: "Mojang", formats: ["Team"], levels: ["HS", "MS"] },
  { slug: "rivals", name: "Marvel Rivals", publisher: "NetEase", formats: ["6v6"], levels: ["HS", "MS"] },
  { slug: "chess", name: "Chess", publisher: "Chess.com", formats: ["1v1", "Team Match"], levels: ["HS", "MS"] },
  { slug: "tetris", name: "Tetris", publisher: "The Tetris Company", formats: ["1v1"], levels: ["HS", "MS"] },

  // --- Middle School (IMSEN) only ---
  { slug: "fortnite", name: "Fortnite", publisher: "Epic Games", formats: ["Squads", "Duos", "Solo"], levels: ["MS"] },
];

const BY_SLUG = new Map(SUPPORTED_GAMES.map((g) => [g.slug, g]));

/** Slugs of titles that are NO LONGER supported — deactivated, not deleted. */
export const DEPRECATED_GAME_SLUGS = ["lol", "nba2k"] as const;

export function isSupportedGame(slug: string): boolean {
  return BY_SLUG.has(slug);
}

export function getSupportedGame(slug: string): SupportedGame | undefined {
  return BY_SLUG.get(slug);
}

/** Games approved for a given level (HS / MS). */
export function gamesForLevel(level: GameLevel): SupportedGame[] {
  return SUPPORTED_GAMES.filter((g) => g.levels.includes(level));
}
