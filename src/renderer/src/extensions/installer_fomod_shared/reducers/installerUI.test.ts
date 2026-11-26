import { describe, it, expect } from "vitest";

import { endDialog, setDialogState, startDialog } from "../actions/installerUI";
import type { IFOMODStateDialog, IInstallerInfoState } from "../types/interface";
import { installerUIReducer } from "./installerUI";

const installerInfo: IInstallerInfoState = {
  moduleName: "test",
  image: { path: "test", showFade: false, height: 0 },
  dataPath: "",
};

describe("startDialog", () => {
  it("starts the installer dialog", () => {
    const input: IFOMODStateDialog = {
      activeInstanceId: null,
      instances: {},
    };
    const instanceId = "testInstance";
    const result = installerUIReducer.reducers.START_FOMOD_DIALOG(
      input,
      startDialog(installerInfo, instanceId).payload,
    );
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
    const input: IFOMODStateDialog = {
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          info: installerInfo,
          state: undefined,
        },
      },
    };
    const result = installerUIReducer.reducers.END_FOMOD_DIALOG(
      input,
      endDialog(instanceId).payload,
    );
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
    const input: IFOMODStateDialog = {
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: { info: undefined, state: undefined },
      },
    };
    const state = {
      installSteps: [],
      currentStep: 1,
    };
    const result = installerUIReducer.reducers.SET_FOMOD_DIALOG_STATE(
      input,
      setDialogState(state, instanceId).payload,
    );
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
