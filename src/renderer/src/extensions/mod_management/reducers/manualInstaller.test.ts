import { VortexGameId } from "@vortex/shared";
import { describe, it, expect } from "vitest";

import { manualInstallerReducer, type IManualInstallerRequest } from "./manualInstaller";

function makeRequest(id: string): IManualInstallerRequest {
  return {
    id,
    gameId: VortexGameId("somegame"),
    modName: `mod ${id}`,
    remaining: 0,
    previewFiles: [],
  };
}

describe("manualInstallerReducer", () => {
  it("queues requests in the order they arrive", () => {
    const first = manualInstallerReducer.reducers.ENQUEUE_MANUAL_INSTALLER_REQUEST(
      { pending: [] },
      makeRequest("a"),
    );
    const second = manualInstallerReducer.reducers.ENQUEUE_MANUAL_INSTALLER_REQUEST(
      first,
      makeRequest("b"),
    );
    expect(second.pending.map((request) => request.id)).toEqual(["a", "b"]);
  });

  it("removes only the answered request", () => {
    const state = { pending: [makeRequest("a"), makeRequest("b")] };
    const result = manualInstallerReducer.reducers.DEQUEUE_MANUAL_INSTALLER_REQUEST(state, "a");
    expect(result.pending.map((request) => request.id)).toEqual(["b"]);
  });
});
