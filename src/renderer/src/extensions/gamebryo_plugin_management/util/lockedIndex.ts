import type { IStateWithGamebryo } from "../types/IStateWithGamebryo";

/** The manually locked mod index of a plugin, if any. */
export function lockedIndex(
  state: IStateWithGamebryo,
  gameId: string,
  pluginId: string,
): number | undefined {
  return state.persistent.plugins?.lockedIndices[gameId]?.[pluginId];
}
