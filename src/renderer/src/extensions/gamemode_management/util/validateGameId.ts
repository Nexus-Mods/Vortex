import { VortexGameId } from "@vortex/shared";

import type { IGame } from "../../../types/IGame";

/**
 * Checks the id of a game an extension registers. The type says it's a {@link VortexGameId},
 * but extensions written in JavaScript or built against older typings pass a plain string, so
 * an empty id still has to be caught here. The game itself is left untouched.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty id.
 */
export function validateGameId(game: IGame): void {
  VortexGameId(game.id);
}
