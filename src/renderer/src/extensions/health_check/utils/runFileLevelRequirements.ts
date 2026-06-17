import type { IExtensionApi } from "../../../types/IExtensionContext";
import { activeProfile } from "../../profile_management/selectors";
import type { IFileRequirementsCheckMetadata } from "../types";

/**
 * Resolve the file-level requirements for the active game.
 *
 * Returns an empty result for now. This is where the file dependency resolution
 * will be implemented.
 *
 * TODO: resolve the active game's file requirements and return them here.
 */
export function runFileLevelRequirements(
  api: IExtensionApi,
): Promise<IFileRequirementsCheckMetadata> {
  const gameId = activeProfile(api.getState())?.gameId ?? "";

  return Promise.resolve({
    gameId,
    modsChecked: 0,
    fileRequirements: {},
    errors: [],
  });
}
