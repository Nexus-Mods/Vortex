// Mock for vortex-api used by extension tests
// Re-exports the real storeHelper utilities from the renderer
import {
  setSafe,
  deleteOrNop,
} from "../../../src/renderer/src/util/storeHelper";

export const util = {
  setSafe,
  deleteOrNop,
};
