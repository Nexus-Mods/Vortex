import type { IReducerSpec } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import * as actions from "../actions/app";
import { deleteOrNop, pushSafe, setSafe } from "../util/storeHelper";

export const appReducer: IReducerSpec<IState["app"]> = {
  reducers: {
    [actions.setStateVersion.getType()]: (state, payload) => setSafe(state, ["version"], payload),
    [actions.setApplicationVersion.getType()]: (state, payload) =>
      setSafe(state, ["appVersion"], payload),
    [actions.addExtension.getType()]: (
      state,
      payload: ReturnType<typeof actions.addExtension>["payload"],
    ) => {
      const { extensionId, info } = payload;
      const existing = state.extensions?.[extensionId] ?? {};
      return setSafe(state, ["extensions", extensionId], {
        ...existing,
        name: info.name,
        version: info.version,
        author: info.author,
        description: info.description,
        path: info.path,
        modId: info.modId,
        fileId: info.fileId,
        type: info.type,
        bundled: info.bundled,
      });
    },
    [actions.setExtensionEnabled.getType()]: (state, payload) =>
      setSafe(state, ["extensions", payload.extensionId, "enabled"], payload.enabled),
    [actions.setExtensionVersion.getType()]: (state, payload) =>
      setSafe(state, ["extensions", payload.extensionId, "version"], payload.version),
    [actions.setExtensionEndorsed.getType()]: (state, payload) =>
      setSafe(state, ["extensions", payload.extensionId, "endorsed"], payload.endorsed),
    [actions.removeExtension.getType()]: (state, payload) =>
      setSafe(state, ["extensions", payload, "remove"], true),
    [actions.forgetExtension.getType()]: (state, payload) =>
      deleteOrNop(state, ["extensions", payload]),
    [actions.setInstanceId.getType()]: (state, payload) => setSafe(state, ["instanceId"], payload),
    [actions.setWarnedAdmin.getType()]: (state, payload) =>
      setSafe(state, ["warnedAdmin"], payload),
    [actions.setInstallType.getType()]: (state, payload) =>
      setSafe(state, ["installType"], payload),
    [actions.completeMigration.getType()]: (state, payload) =>
      pushSafe(state, ["migrations"], payload),
  },
  defaults: {
    instanceId: undefined,
    version: "",
    appVersion: "",
    extensions: {},
    warnedAdmin: 0,
    migrations: [],
    installType: "regular",
  },
  verifiers: {
    instanceId: {
      description: () => "No instance id set",
      type: "string",
    },
    version: {
      description: () => "Version not set",
      type: "string",
    },
    appVersion: {
      description: () => "Application version not set",
      type: "string",
    },
    extensions: {
      description: () => "Resetting list of disabled extensions",
      noUndefined: true,
    },
  },
};
