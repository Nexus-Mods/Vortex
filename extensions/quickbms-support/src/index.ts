import path from "path";

import AttribDashlet from "./AttribDashlet";
import {
  IAttachmentData,
  IListEntry,
  IQBMSOpProps,
  IQBMSOptions,
  QBMSOperationType,
  QuickBMSError,
  UnregisteredGameError,
} from "./types";

import { fs, log, selectors, types, util } from "vortex-api";

const GAME_SUPPORT: string[] = [];
const DEPRECATED_NOTIF_ID = "deprecated-qbms-call";

let _GAMEMODE_SUPPORTED = false;

function showAttrib(state: types.IState) {
  const gameMode = selectors.activeGameId(state);
  return GAME_SUPPORT.includes(gameMode);
}

function queryAttachment(data: IAttachmentData) {
  return fs
    .statAsync(data.filePath)
    .then(() => Promise.resolve(data))
    .catch((err) => Promise.resolve(undefined));
}

async function successfulOp(
  context: types.IExtensionContext,
  props: IQBMSOpProps,
  data?: any,
) {
  const id = "qbms-success-notif";
  const state = context.api.store.getState();
  const notifications = util.getSafe(
    state,
    ["session", "notifications", "notifications"],
    [],
  );
  if (
    props.quiet !== true &&
    notifications.find((notif) => notif.id === id) === undefined
  ) {
    context.api.sendNotification({
      id,
      type: "success",
      message: "QBMS operation completed",
      displayMS: 3000,
    });
  }
  if (props.callback !== undefined) {
    props.callback(undefined, data);
  }
  return Promise.resolve();
}

async function errorHandler(
  api: types.IExtensionApi,
  props: IQBMSOpProps,
  err: any,
): Promise<void> {
  const { callback, gameMode } = props;
  const state = api.store.getState();
  const contributed = selectors.gameById(state, gameMode)?.contributed;
  const mods = util.getSafe(state, ["persistent", "mods", gameMode], {});
  const modKeys = Object.keys(mods);
  const attachments: types.IAttachment[] = [
    {
      id: "installedMods",
      type: "data",
      data: modKeys.join("\n") || "None",
      description: "List of installed mods",
    },
  ];

  const qbmsLog: IAttachmentData = {
    filePath: path.join(util.getVortexPath("userData"), "quickbms.log"),
    description: "QuickBMS log file",
  };

  const vortexLog: IAttachmentData = {
    filePath: path.join(util.getVortexPath("userData"), "vortex.log"),
    description: "Vortex log file",
  };

  let addedAttachments: IAttachmentData[] = [];
  if (props.additionalAttachments !== undefined) {
    addedAttachments = await props.additionalAttachments();
  }

  if (err instanceof UnregisteredGameError) {
    err["message"] += " - did you forget to call qbmsRegisterGame?";
  } else if (err instanceof QuickBMSError) {
    err["message"] += "\n\n" + (err as QuickBMSError).errorLines;
  }

  return Promise.all(
    [qbmsLog, vortexLog, ...addedAttachments].map((file) =>
      queryAttachment(file),
    ),
  )
    .then((files) => {
      const validAttachments = files.filter((file) => !!file);
      validAttachments.forEach((att) => {
        attachments.push({
          id: path.basename(att.filePath),
          type: "file",
          data: att.filePath,
          description: att.description,
        });
      });
    })
    .then(() => {
      if (_GAMEMODE_SUPPORTED) {
        if (props.quiet !== true) {
          api.showErrorNotification("failed to execute qbms operation", err, {
            allowReport: contributed !== undefined,
            attachments,
          });
        }

        if (callback) {
          callback(err, undefined);
        }
      } else {
        if (callback) {
          log("info", "qbms encountered an error", err.message);
          callback(
            new util.ProcessCanceled("[QBMS] " + err.message),
            undefined,
          );
        }
      }
    });
}

function testGameRegistered(props: IQBMSOpProps): Promise<void> {
  return !GAME_SUPPORT.includes(props.gameMode)
    ? Promise.reject(new UnregisteredGameError(props.gameMode))
    : Promise.resolve();
}

function sanitizeProps(
  props: IQBMSOpProps,
  opType: QBMSOperationType,
): IQBMSOpProps {
  if (props.qbmsOptions === undefined) {
    props.qbmsOptions = {
      wildCards: ["{}"],
    };
  }

  if (opType === "reimport" && props.qbmsOptions.allowResize === undefined) {
    // default to reimport method 1
    props.qbmsOptions.allowResize = false;
  }

  if (
    opType === "write" &&
    props.operationPath !== undefined &&
    props.operationPath.endsWith(path.sep)
  ) {
    props.operationPath = props.operationPath.substr(
      0,
      props.operationPath.length - 1,
    );
  }

  return props;
}

function list(context: types.IExtensionContext, props: IQBMSOpProps) {
  props = sanitizeProps(props, "list");
  return require("./quickbms")
    .list(props)
    .then((listEntries) =>
      props.callback !== undefined
        ? successfulOp(context, props, listEntries)
        : Promise.resolve(),
    )
    .catch((err) => errorHandler(context.api, props, err));
}

function extract(context: types.IExtensionContext, props: IQBMSOpProps) {
  props = sanitizeProps(props, "extract");
  return require("./quickbms")
    .extract(props)
    .then(() =>
      props.callback !== undefined
        ? successfulOp(context, props)
        : Promise.resolve(),
    )
    .catch((err) => errorHandler(context.api, props, err));
}

function write(context: types.IExtensionContext, props: IQBMSOpProps) {
  props = sanitizeProps(props, "write");
  return require("./quickbms")
    .write(props)
    .then(() =>
      props.callback !== undefined
        ? successfulOp(context, props)
        : Promise.resolve(),
    )
    .catch((err) => errorHandler(context.api, props, err));
}

function reImport(context: types.IExtensionContext, props: IQBMSOpProps) {
  props = sanitizeProps(props, "reimport");
  return require("./quickbms")
    .reImport(props)
    .then(() =>
      props.callback !== undefined
        ? successfulOp(context, props)
        : Promise.resolve(),
    )
    .catch((err) => errorHandler(context.api, props, err));
}

function raiseDeprecatedAPINotification(context: types.IExtensionContext) {
  const state = context.api.store.getState();
  const notifications = util.getSafe(
    state,
    ["session", "notifications", "notifications"],
    [],
  );
  if (
    notifications.find((not) => not.id === DEPRECATED_NOTIF_ID) === undefined
  ) {
    context.api.sendNotification({
      id: DEPRECATED_NOTIF_ID,
      message: "Game extension is using deprecated QBMS API calls",
      type: "warning",
      noDismiss: true,
      actions: [
        {
          title: "More",
          action: () =>
            context.api.showDialog(
              "info",
              "Deprecated QB API",
              {
                text:
                  "This extension is using deprecated QBMS API calls which will eventually be removed - " +
                  "please inform the extension developer to update it ASAP!",
              },
              [{ label: "Close" }],
            ),
        },
      ],
    });
  }
}

function init(context: types.IExtensionContext) {
  context.registerDashlet(
    "QBMS Support",
    1,
    2,
    250,
    AttribDashlet,
    showAttrib,
    () => ({}),
    undefined,
  );

  context.registerAPI(
    "qbmsRegisterGame",
    (gameMode: string) => {
      GAME_SUPPORT.push(gameMode);
    },
    { minArguments: 1 },
  );

  context.registerAPI(
    "qbmsList",
    (props: IQBMSOpProps) => list(context, props),
    { minArguments: 1 },
  );
  context.registerAPI(
    "qbmsExtract",
    (props: IQBMSOpProps) => extract(context, props),
    { minArguments: 1 },
  );
  context.registerAPI(
    "qbmsWrite",
    (props: IQBMSOpProps) => write(context, props),
    { minArguments: 1 },
  );
  context.registerAPI(
    "qbmsReimport",
    (props: IQBMSOpProps) => reImport(context, props),
    { minArguments: 1 },
  );

  context.once(() => {
    context.api.events.on("gamemode-activated", (gameMode: string) => {
      context.api.dismissNotification(DEPRECATED_NOTIF_ID);
      _GAMEMODE_SUPPORTED = GAME_SUPPORT.includes(gameMode);
    });
    context.api.events.on(
      "quickbms-operation",
      (
        bmsScriptPath: string,
        archivePath: string,
        inPath: string,
        opType: QBMSOperationType,
        options: IQBMSOptions,
        callback: (err: Error, data: IListEntry[]) => void,
      ) => {
        // Leaving this here temporarily for backwards compatibility
        raiseDeprecatedAPINotification(context);

        const state = context.api.store.getState();
        const activeGameId = selectors.activeGameId(state);
        const props: IQBMSOpProps = {
          gameMode: activeGameId,
          bmsScriptPath,
          archivePath,
          operationPath: inPath,
          qbmsOptions: options,
          callback,
        };

        if (!GAME_SUPPORT.includes(activeGameId)) {
          // Not a registered game.
          return testGameRegistered(props).catch((err) =>
            errorHandler(context.api, props, err),
          );
        }

        switch (opType) {
          case "extract":
            return extract(context, props);
          case "reimport":
            return reImport(context, props);
          case "write":
            return write(context, props);
          case "list":
          default:
            return list(context, props);
        }
      },
    );
  });

  return true;
}

export default init;
