import * as path from "path";
import * as url from "url";

import type { IDiscoveryResult } from "../../../../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../../../../extensions/gamemode_management/types/IGameStored";

export const getGameImageUrl = (
  game: IGameStored,
  discovery: IDiscoveryResult | undefined,
): string | undefined => {
  // Check discovery for custom logo first
  const logo = discovery?.logo ?? game.logo;
  const extensionPath = discovery?.extensionPath ?? game.extensionPath;

  if (extensionPath !== undefined && logo !== undefined) {
    const logoPath = path.join(extensionPath, logo);
    return url.pathToFileURL(logoPath).href;
  }

  // Fall back to imageURL (remote URL)
  if (game.imageURL !== undefined) {
    return game.imageURL;
  }

  return undefined;
};

// Pool of emojis for profile identification
const PROFILE_EMOJIS = [
  "🎮",
  "🎯",
  "🎲",
  "🎨",
  "🎭",
  "🎪",
  "🎺",
  "🎸",
  "🎹",
  "🎼",
  "🎵",
  "🎬",
  "🎤",
  "🎧",
  "🎩",
  "🎪",
  "⚔️",
  "🏹",
  "🛡️",
  "🗡️",
  "🪓",
  "🔨",
  "⚒️",
  "🔧",
  "⚡",
  "🔥",
  "💧",
  "❄️",
  "🌟",
  "⭐",
  "✨",
  "💫",
  "🌙",
  "☀️",
  "🌈",
  "🌸",
  "🌺",
  "🌻",
  "🌹",
  "🌷",
  "🍀",
  "🌿",
  "🌲",
  "🌳",
  "🌴",
  "🌵",
  "🌾",
  "🌱",
  "🐉",
  "🐲",
  "🦄",
  "🦅",
  "🦉",
  "🦊",
  "🐺",
  "🦁",
  "🐯",
  "🐻",
  "🐼",
  "🐨",
  "🐸",
  "🐢",
  "🦎",
  "🐍",
  "👑",
  "💎",
  "🔮",
  "🎁",
  "🏆",
  "🥇",
  "🥈",
  "🥉",
];

/**
 * Simple string hash function for deterministic emoji selection
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Gets a deterministic emoji from the profile emoji pool based on a seed
 * If no seed is provided, returns a random emoji
 */
export const getRandomProfileEmoji = (seed?: string): string => {
  if (seed !== undefined) {
    const hash = hashString(seed);
    const index = hash % PROFILE_EMOJIS.length;
    return PROFILE_EMOJIS[index];
  }
  const randomIndex = Math.floor(Math.random() * PROFILE_EMOJIS.length);
  return PROFILE_EMOJIS[randomIndex];
};
