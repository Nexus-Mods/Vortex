import { activeGameId } from "../../../src/renderer/src/extensions/profile_management/selectors";
// Mock for vortex-api used by extension tests
// Re-exports the real selectors, reducer builders and storeHelper utilities from the renderer
import {
  actionsToPartialReducerSpec,
  actionsToReducerSpec,
} from "../../../src/renderer/src/reducers/builder";
import { getSafe, setSafe } from "../../../src/renderer/src/util/storeHelper";

export const selectors = {
  activeGameId,
};

export const util = {
  actionsToReducerSpec,
  actionsToPartialReducerSpec,
  getSafe,
  setSafe,
};
