import { log } from '../util/log';

/**
 * Shared utility function to check for duplicate game entries in load order extensions
 * and log appropriate debug messages.
 * 
 * @param gameId - The game ID to check for duplicates
 * @param existingGames - Array of existing games to check against
 * @param extensionType - Type of extension for logging context (e.g., 'file_based_loadorder', 'mod_load_order')
 * @returns true if duplicate found, false otherwise
 */
export function checkAndLogDuplicateGameEntry<T extends { gameId: string }>(
  gameId: string,
  existingGames: T[],
  extensionType: string
): boolean {
  const isDuplicate = existingGames.find(game => game.gameId === gameId) !== undefined;
  
  if (isDuplicate) {
    log('debug', `attempted to add duplicate gameEntry to ${extensionType} extension`, gameId);
  }
  
  return isDuplicate;
}