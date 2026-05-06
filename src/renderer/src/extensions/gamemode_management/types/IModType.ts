import type PromiseBB from "bluebird";

import type { IInstruction, IModTypeOptions } from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";

export interface IModType {
  typeId: string;
  priority: number;
  isSupported: (gameId: string) => boolean;
  getPath: (game: IGame) => string;
  test: (installInstructions: IInstruction[]) => PromiseBB<boolean>;
  options: IModTypeOptions;
}
