import type { EndorsedStatus } from "@nexusmods/nexus-api";
import { createAction } from "redux-act";

import type { IExtensionState } from "@/types/IState";

import type { VortexInstallType } from "../types/VortexInstallType";

const id = <T>(input: T): T => input;

export const setStateVersion = createAction("SET_STATE_VERSION", id<string>);

export const setApplicationVersion = createAction("SET_APPLICATION_VERSION", id<string>);

export const addExtension = createAction("ADD_EXTENSION", (extension: IExtensionState) => ({
  extension,
}));

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
  (extensionId: string, endorsed: EndorsedStatus) => ({ extensionId, endorsed }),
);

export const removeExtension = createAction("REMOVE_EXTENSION", id<string>);

export const forgetExtension = createAction("FORGET_EXTENSION", id<string>);

export const completeMigration = createAction("COMPLETE_MIGRATION", id<string>);

export const setInstanceId = createAction("SET_INSTANCE_ID", id<string>);

export const setWarnedAdmin = createAction("SET_WARNED_ADMIN", id<number>);

export const setInstallType = createAction("SET_INSTALL_TYPE", id<VortexInstallType>);

export const setUpdaterActive = createAction("SET_UPDATER_ACTIVE", id<boolean>);
