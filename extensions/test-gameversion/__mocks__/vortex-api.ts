// Mock for vortex-api used by extension tests
// Re-exports the real selectors and storeHelper utilities from the renderer
import { activeGameId } from "../../../src/renderer/src/extensions/profile_management/selectors";
import { getSafe, setSafe } from "../../../src/renderer/src/util/storeHelper";

export const selectors = {
  activeGameId,
};

export const util = {
  getSafe,
  setSafe,
};
