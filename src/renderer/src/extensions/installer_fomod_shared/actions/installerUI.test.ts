import { describe, it, expect } from "vitest";

import * as actions from "./installerUI";

describe("startDialog", () => {
  it("creates the correct action", () => {
    const installerInfo = {
      moduleName: "test",
      image: { path: "test", showFade: false, height: 0 },
      dataPath: "",
    };
    const instanceId = "testInstance";
    expect(actions.startDialog(installerInfo, instanceId)).toEqual({
      error: false,
      type: "START_FOMOD_DIALOG",
      payload: { info: installerInfo, instanceId: instanceId },
    });
  });
});

describe("endDialog", () => {
  it("creates the correct action", () => {
    const instanceId = "testInstance";
    expect(actions.endDialog(instanceId)).toEqual({
      error: false,
      payload: { instanceId: instanceId },
      type: "END_FOMOD_DIALOG",
    });
  });
});

describe("setDialogState", () => {
  it("creates the correct action", () => {
    const state = {
      installSteps: [],
      currentStep: 1,
    };
    const instanceId = "testInstance";
    expect(actions.setDialogState(state, instanceId)).toEqual({
      error: false,
      type: "SET_FOMOD_DIALOG_STATE",
      payload: { dialogState: state, instanceId: instanceId },
    });
  });
});
