import { createAction } from "redux-act";

import type { IExtensionState } from "../types/IState";
import type { VortexInstallType } from "../types/VortexInstallType";

const identity = <T>(input: T): T => input;

export const setStateVersion = createAction("SET_STATE_VERSION", (version) => version);

export const setApplicationVersion = createAction("SET_APPLICATION_VERSION", (version) => version);

export const addExtension = createAction(
  "ADD_EXTENSION",
  (extensionId: string, info: Partial<IExtensionState>) => ({ extensionId, info }),
);

export const setExtensionEnabled = createAction(
  "SET_EXTENSION_ENABLED",
  (extensionId: string, enabled: boolean) => ({ extensionId, enabled }),
);

export const setExtensionVersion = createAction(
  "SET_EXTENSION_VERSION",
  (extensionId: string, version: string) => ({ extensionId, version }),
);

export const setExtensionEndorsed = createAction(
  "SET_EXTENSION_ENDORSED",
  (extensionId: string, endorsed: string) => ({ extensionId, endorsed }),
);

export const removeExtension = createAction("REMOVE_EXTENSION", identity);

export const forgetExtension = createAction("FORGET_EXTENSION", identity);

export const completeMigration = createAction("COMPLETE_MIGRATION", identity);

export const setInstanceId = createAction("SET_INSTANCE_ID", identity);

export const setWarnedAdmin = createAction("SET_WARNED_ADMIN", identity);

export const setInstallType = createAction("SET_INSTALL_TYPE", (type: VortexInstallType) => type);
