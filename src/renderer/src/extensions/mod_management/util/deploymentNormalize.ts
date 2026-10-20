import type { IState } from "../../../types/IState";
import getNormalizeFunc, { type Normalize } from "../../../util/getNormalizeFunc";
import { isWindowsGame } from "../../../util/isWindowsGame";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame } from "../../gamemode_management/util/getGame";

/**
 * Normalizes paths in a game's deployment target. A Windows game sees its files
 * case-insensitively even on a case-sensitive file system, so its paths are folded.
 */
export function getDeploymentNormalizeFunc(
  state: IState,
  gameId: string,
  deployPath: string,
): PromiseLike<Normalize> {
  const caseInsensitive = isWindowsGame(getGame(gameId), discoveryByGame(state, gameId));
  return getNormalizeFunc(deployPath, { caseInsensitive });
}
