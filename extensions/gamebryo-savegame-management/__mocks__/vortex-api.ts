// Mock for vortex-api used by extension tests
// Re-exports the real reducer builders and storeHelper utilities from the renderer
import {
  actionsToPartialReducerSpec,
  actionsToReducerSpec,
} from "../../../src/renderer/src/reducers/builder";
import { setSafe, deleteOrNop } from "../../../src/renderer/src/util/storeHelper";

export const util = {
  actionsToReducerSpec,
  actionsToPartialReducerSpec,
  setSafe,
  deleteOrNop,
};
