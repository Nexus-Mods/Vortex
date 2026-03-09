import path from 'path';

// DAH! extension only support .pak mods.
export const MOD_FILE_EXT = '.pak';
export const GAME_ID = 'spyroreignitedtrilogy';
export const LO_FILE_NAME = 'loadOrder.json';

export function modsRelPath() {
  return path.join('falcon', 'content', 'paks', '~mods');
}
