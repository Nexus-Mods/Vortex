import { VortexGameId } from "@vortex/shared";

import type { IGame, IRegisteredGame } from "../../../types/IGame";

/**
 * Checks that the game an extension registers has an id that can be a {@link VortexGameId},
 * so Vortex can hold it as an {@link IRegisteredGame}. A brand changes no value, so the game
 * is left untouched: a class whose id is a getter registers the same as an object literal.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty id.
 */
export function assertRegisteredGame(game: IGame): asserts game is IRegisteredGame {
  VortexGameId(game.id);
}
