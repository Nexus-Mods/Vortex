import type {
  IInstruction,
  IModTypeOptions,
} from "../../../renderer/types/IExtensionContext";
import type { IGame } from "../../../renderer/types/IGame";

import type PromiseBB from "bluebird";

export interface IModType {
  typeId: string;
  priority: number;
  isSupported: (gameId: string) => boolean;
  getPath: (game: IGame) => string;
  test: (installInstructions: IInstruction[]) => PromiseBB<boolean>;
  options: IModTypeOptions;
}
