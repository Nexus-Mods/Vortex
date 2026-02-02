import MetaEditorDialog from "./views/MetaEditorDialog";

import { setShowMetaEditor } from "./actions";
import sessionReducer from "./reducers";

import type { ILookupResult, IModInfo } from "modmeta-db";
import * as path from "path";
import semver = require("semver");
import * as url from "url";
import { inspect } from "util";
import { log, selectors, types } from "vortex-api";

function getEmptyData(filePath?: string, fileInfo?: any): IModInfo {
  const fileName =
    filePath !== undefined
      ? path.basename(filePath, path.extname(filePath))
      : "";
  return {
    fileName,
    fileSizeBytes: fileInfo !== undefined ? fileInfo.size : 0,
    gameId: fileInfo.game,
    fileVersion: "",
    fileMD5: fileInfo !== undefined ? fileInfo.fileMD5 : "",
    sourceURI: "",
    rules: [],
    details: {},
  };
}

async function retrieveInfoImpl(
  api: types.IExtensionApi,
  downloadId: string,
): Promise<IModInfo> {
  if (downloadId === undefined) {
    return undefined;
  }

  const state = api.getState();
  const downloads = state.persistent.downloads.files;
  const downloadPath = selectors.downloadPath(state);

  if (downloads[downloadId].localPath === undefined) {
    return undefined;
  }

  const filePath = path.join(downloadPath, downloads[downloadId].localPath);

  api.sendNotification({
    id: "meta-lookup",
    type: "activity",
    message: "Mod lookup...",
  });

  try {
    const info: ILookupResult[] = await api.lookupModMeta({
      filePath,
      fileMD5: downloads[downloadId].fileMD5,
      fileSize: downloads[downloadId].size,
      gameId: downloads[downloadId].game[0],
    });

    api.dismissNotification("meta-lookup");

    if (info.length > 0) {
      return {
        fileName: filePath,
        fileMD5: downloads[downloadId].fileMD5,
        fileSizeBytes: downloads[downloadId].size,
        gameId: downloads[downloadId].game,
        ...info[0].value,
      };
    }
  } catch (err) {
    log("info", "Failed to look up mod meta information", {
      err: inspect(err),
    });
    api.dismissNotification("meta-lookup");
  }
  return getEmptyData(filePath, downloads[downloadId]);
}

function validateVersion(version: string) {
  return semver.valid(version) === null ? "error" : "success";
}

function validateURI(uri: string) {
  try {
    const parsedUrl = new URL(uri);
    return parsedUrl.host === null ? "error" : "success";
  } catch {
    return "error";
  }
}

function main(context: types.IExtensionContext) {
  context.registerReducer(["session", "metaEditor"], sessionReducer);

  const retrieveInfo = (visibleId: string) =>
    retrieveInfoImpl(context.api, visibleId);

  context.registerDialog("meta-editor-dialog", MetaEditorDialog, () => ({
    retrieveInfo,
    validateVersion,
    validateURI,
  }));

  context.registerAction(
    "downloads-action-icons",
    100,
    "edit",
    {},
    "View Meta Data",
    (instanceIds: string[]) => {
      context.api.store.dispatch(setShowMetaEditor(instanceIds[0]));
    },
    (instanceIds: string[]): boolean => {
      const state: types.IState = context.api.store.getState();
      return (
        state.persistent.downloads.files[instanceIds[0]].state === "finished"
      );
    },
  );

  context.once(() => {
    context.api.setStylesheet(
      "meta-editor",
      path.join(__dirname, "metaeditor.scss"),
    );
  });

  return true;
}

export default main;
