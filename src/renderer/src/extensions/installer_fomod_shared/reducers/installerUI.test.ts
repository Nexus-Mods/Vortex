import { describe, it, expect } from "vitest";

import { installerUIReducer } from "./installerUI";

describe("startDialog", () => {
  it("starts the installer dialog", () => {
    const input = {
      activeInstanceId: null,
      instances: {},
    };
    const installerInfo = {
      moduleName: "test",
      image: "test",
    };
    const instanceId = "testInstance";
    const result = installerUIReducer.reducers.START_FOMOD_DIALOG(input, {
      info: installerInfo,
      instanceId,
    });
    expect(result).toEqual({
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          info: installerInfo,
        },
      },
    });
  });
});

describe("endDialog", () => {
  it("ends the installer dialog", () => {
    const instanceId = "testInstance";
    const input = {
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          info: { modulename: "test", image: "test" },
        },
      },
    };
    const result = installerUIReducer.reducers.END_FOMOD_DIALOG(input, {
      instanceId,
    });
    expect(result).toEqual({
      activeInstanceId: null,
      instances: {
        [instanceId]: {
          info: null,
        },
      },
    });
  });
});

describe("setDialogState", () => {
  it("sets the installer dialog state", () => {
    const instanceId = "testInstance";
    const input = {
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {},
      },
    };
    const state = {
      installSteps: [],
      currentStep: 1,
    };
    const result = installerUIReducer.reducers.SET_FOMOD_DIALOG_STATE(input, {
      dialogState: state,
      instanceId,
    });
    expect(result).toEqual({
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          state: state,
        },
      },
    });
  });
});
