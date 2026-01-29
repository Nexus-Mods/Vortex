import {
  addFeedbackFile,
  setFeedbackHash,
  setFeedbackMessage,
  setFeedbackTitle,
  setFeedbackType,
} from "./actions/session";
import { sessionReducer } from "./reducers/session";
import { IFeedbackFile } from "./types/IFeedbackFile";

import FeedbackView from "./views/FeedbackView";

import Promise from "bluebird";
import * as path from "path";
import * as tmp from "tmp";
import { fs, log, types, util } from "vortex-api";
import * as winapiT from "winapi-bindings";

const FEEDBACK_GOOGLE_FORM = "https://forms.gle/YF9ED2Xe4ef9jKf99";

const VORTEX_ISSUE_TRACKER = "https://github.com/Nexus-Mods/Vortex/issues";

const WHITESCREEN_THREAD =
  "https://forums.nexusmods.com/index.php?/topic/7151166-whitescreen-reasons/";

function originalUserData() {
  if (process.platform === "win32" && process.env.APPDATA !== undefined) {
    return path.join(process.env.APPDATA, util["getApplication"]().name);
  } else {
    return util.getVortexPath("userData");
  }
}

function findCrashDumps(): Promise<string[]> {
  const nativeCrashesPath = path.join(
    util.getVortexPath("userData"),
    "temp",
    "dumps",
  );
  // this directory isn't even actually used?
  const electronCrashesPath = path.join(
    originalUserData(),
    "temp",
    "Vortex Crashes",
    "reports",
  );

  return fs
    .ensureDirAsync(nativeCrashesPath)
    .then(() => fs.readdirAsync(nativeCrashesPath))
    .catch(() => [])
    .filter((filePath: string) => path.extname(filePath) === ".dmp")
    .map((iterPath: string) => path.join(nativeCrashesPath, iterPath))
    .then((nativeCrashes: string[]) =>
      fs
        .readdirAsync(electronCrashesPath)
        .catch(() => [])
        .filter((filePath: string) => path.extname(filePath) === ".dmp")
        .map((iterPath: string) => path.join(electronCrashesPath, iterPath))
        .then((electronPaths: string[]) =>
          [].concat(nativeCrashes, electronPaths),
        ),
    );
}

enum ErrorType {
  CLR,
  OOM,
  APP,
}

const KNOWN_ERRORS = {
  e0000001: ErrorType.APP,
  e0000002: ErrorType.APP,
  e0434f4d: ErrorType.CLR,
  e0000008: ErrorType.OOM,
};

function oldMSXMLLoaded() {
  const winapi: typeof winapiT = require("winapi-bindings");
  const reMatch = /msxml[56].dll/;
  const msxml = winapi
    .GetModuleList(null)
    .find((mod) => mod.module.match(reMatch));
  return msxml !== undefined;
}

function errorText(type: ErrorType): string {
  if (type === ErrorType.APP) {
    // right now we only get here if the msxml file is loaded, if we ever find other common
    // causes of these extensions we need to differentiate here
    return (
      "This exception seems to be caused by a bug in a dll that got shipped with old " +
      "versions of MS Office. " +
      "It should be safe to ignore it but if you want to get rid of the message you " +
      "should check for updates to Office."
    );
  }

  switch (type) {
    case ErrorType.CLR:
      return (
        "The exception you got indicates that the installation of the " +
        ".NET Framework installed on your system is invalid. " +
        "This should be easily solved by reinstalling it."
      );
    case ErrorType.OOM:
      return (
        "The exception you got indicates an out of memory situation. " +
        "This can have different reasons, most commonly a system misconfiguration where it " +
        "doesn't provide enough virtual memory for stable operation."
      );
  }
}

function recognisedError(crashDumps: string[]): Promise<ErrorType> {
  return Promise.map(crashDumps, (dumpPath) =>
    fs
      .readFileAsync(dumpPath + ".log", { encoding: "utf-8" })
      .then((data) => {
        try {
          const codeLine: string[] = data
            .split("\r\n")
            .filter((line) => line.startsWith("Exception code"));
          return Promise.resolve(codeLine.map((line) => line.split(": ")[1]));
        } catch (err) {
          return Promise.reject(new Error("Failed to parse"));
        }
      })
      .catch(() => null),
  )
    .filter((codes: string) => !!codes)
    .reduce((prev, codes) => prev.concat(codes), [])
    .filter((code: string) => {
      const known = KNOWN_ERRORS[code];
      if (known === undefined) {
        return false;
      }
      if (known === ErrorType.APP) {
        return oldMSXMLLoaded();
      }
      return true;
    })
    .then((codes) => (codes.length > 0 ? KNOWN_ERRORS[codes[0]] : undefined));
}

function reportKnownError(
  api: types.IExtensionApi,
  dismiss: () => void,
  errType: ErrorType,
) {
  const bbcode =
    errorText(errType) +
    "<br/><br/>Please visit " +
    `[url="${WHITESCREEN_THREAD}"]` +
    "this thread[/url] for more in-depth information.";
  return api.showDialog(
    "info",
    "Exception occurred",
    {
      bbcode,
    },
    [{ label: "Close" }],
  );
}

function sendCrashFeedback(
  api: types.IExtensionApi,
  dismiss: () => void,
  crashDumps: string[],
) {
  api.store.dispatch(setFeedbackType("bugreport", "crash"));
  return (
    Promise.map(
      crashDumps.reduce((prev, iter) => prev.concat(iter, iter + ".log"), []),
      (dump) =>
        fs
          .statAsync(dump)
          .then((stats) => ({ filePath: dump, stats }))
          // This shouldn't happen unless the user deleted the
          //  crashdump before hitting the Send Report button.
          //  Either way the application shouldn't crash; keep going.
          .catch((err) =>
            err.code === "ENOENT" ? undefined : Promise.reject(err),
          ),
    )
      .filter((iter) => iter !== undefined)
      .each((iter: { filePath: string; stats: fs.Stats }) => {
        api.store.dispatch(
          addFeedbackFile({
            filename: path.basename(iter.filePath),
            filePath: iter.filePath,
            size: iter.stats.size,
            type: "Dump",
          }),
        );
      })
      // Do we actually want to report an issue with the native
      //  crash dumps at this point? Or should we just keep going ?
      .catch(() => undefined)
      .then(() => {
        api.events.emit("show-main-page", "Feedback");
        dismiss();
      })
  );
}

function nativeCrashCheck(api: types.IExtensionApi): Promise<void> {
  return findCrashDumps()
    .then((crashDumps) =>
      crashDumps.length === 0
        ? Promise.resolve()
        : recognisedError(crashDumps).then((knownError) => {
            const actions = [
              {
                title: "Dismiss",
                action: (dismiss) => {
                  Promise.map(crashDumps, (dump) =>
                    fs
                      .removeAsync(dump)
                      .catch(() => undefined)
                      .then(() => fs.removeAsync(dump + ".log"))
                      .catch(() => undefined),
                  ).then(() => {
                    log("info", "crash dumps dismissed");
                    dismiss();
                  });
                },
              },
            ];

            if (knownError === undefined) {
              actions.splice(0, 0, {
                title: "More",
                action: (dismiss) => {
                  const bbcode =
                    "The last session of Vortex logged an exception." +
                    "<br/><br/>Please visit " +
                    `[url="${WHITESCREEN_THREAD}"]this thread[/url] ` +
                    "for typical reasons causing this.<br/>" +
                    '[color="red"]Please report this issue only if you\'re sure none of ' +
                    "those reasons apply to you![/color]";

                  return api.showDialog(
                    "error",
                    "Exception",
                    {
                      bbcode,
                    },
                    [
                      {
                        label: "Report",
                        action: () => {
                          sendCrashFeedback(api, dismiss, crashDumps);
                        },
                      },
                      { label: "Close" },
                    ],
                  );
                },
              });
            } else {
              actions.splice(0, 0, {
                title: "More",
                action: (dismiss) => reportKnownError(api, dismiss, knownError),
              });
            }

            api.sendNotification({
              type: "error",
              title: "Exception",
              message: "Last Vortex session crashed",
              noDismiss: true,
              actions,
            });
          }),
    )
    .catch((err) => {
      // There is almost certainly a more serious underlying problem but this
      // particular symptom isn't worth reporting
      log("warn", "Failed to check for native dumps", err.message);
    });
}

function readReferenceIssues() {
  return fs
    .readFileAsync(path.join(__dirname, "issues.json"), { encoding: "utf-8" })
    .then((data) => {
      return JSON.parse(data);
    });
}

function identifyAttachment(
  filePath: string,
  type?: string,
): Promise<IFeedbackFile> {
  return fs.statAsync(filePath).then((stats) => ({
    filename: path.basename(filePath),
    filePath,
    size: stats.size,
    type: type || path.extname(filePath).slice(1),
  }));
}

function logPath(fileName: string): string {
  return path.join(util.getVortexPath("userData"), fileName);
}

function dumpStateToFileImpl(
  api: types.IExtensionApi,
  stateKey: string,
  name: string,
): Promise<IFeedbackFile> {
  return new Promise<IFeedbackFile>((resolve, reject) => {
    const data: Buffer = Buffer.from(
      JSON.stringify(api.store.getState()[stateKey]),
    );
    tmp.file(
      {
        prefix: `${stateKey}-`,
        postfix: ".json",
      },
      (err, tmpPath: string, fd: number) => {
        if (err !== null) {
          return reject(err);
        }

        fs.writeAsync(fd, data, 0, data.byteLength, 0)
          .then(() => fs.closeAsync(fd))
          .then(() => {
            resolve({
              filename: name,
              filePath: tmpPath,
              size: data.byteLength,
              type: "State",
            });
          })
          .catch(reject);
      },
    );
  });
}

function dumpReduxActionsToFile(name: string): Promise<IFeedbackFile> {
  return new Promise<IFeedbackFile>((resolve, reject) => {
    tmp.file(
      {
        prefix: "events-",
        postfix: ".json",
      },
      (err, tmpPath: string, fd: number) => {
        if (err !== null) {
          return reject(err);
        }
        util.getReduxLog().then((logData: any) => {
          const data = Buffer.from(JSON.stringify(logData, undefined, 2));
          fs.writeAsync(fd, data, 0, data.byteLength, 0)
            .then(() => fs.closeAsync(fd))
            .then(() => {
              resolve({
                filename: name,
                filePath: tmpPath,
                size: data.byteLength,
                type: "State",
              });
            })
            .catch(reject);
        });
      },
    );
  });
}

function removeFiles(fileNames: string[]): Promise<void> {
  return Promise.all(
    fileNames.map((removeFile) => fs.removeAsync(removeFile)),
  ).then(() => null);
}

function init(context: types.IExtensionContext) {
  context.registerReducer(["session", "feedback"], sessionReducer);

  const dumpStateToFile = (stateKey: string, name: string) =>
    dumpStateToFileImpl(context.api, stateKey, name);

  context.registerMainPage("", "Feedback", FeedbackView, {
    hotkey: "F",
    group: "hidden",
    props: () => ({
      readReferenceIssues,
      identifyAttachment,
      logPath,
      dumpStateToFile,
      dumpReduxActionsToFile,
      removeFiles,
    }),
  });

  context.registerAction(
    "global-icons",
    100,
    "feedback",
    {},
    "Send Feedback",
    () => util.opn(FEEDBACK_GOOGLE_FORM).catch(() => null) as any,
  );

  context.registerAction(
    "global-icons",
    100,
    "bug",
    {},
    "Report Bug",
    () => util.opn(VORTEX_ISSUE_TRACKER).catch(() => null) as any,
  );

  context.once(() => {
    context.api.setStylesheet(
      "feedback",
      path.join(__dirname, "feedback.scss"),
    );

    context.api.events.on(
      "report-feedback",
      (title: string, text: string, files: IFeedbackFile[], hash?: string) => {
        context.api.sendNotification({
          id: "report-feedback",
          type: "info",
          message: "Please report this on our issue tracker",
          actions: [
            {
              title: "View Logs/Open issue tracker",
              action: () => {
                util.opn(VORTEX_ISSUE_TRACKER).catch(() => null);
                (files || []).forEach((file) => {
                  util.opn(file.filePath).catch(() => null);
                });
              },
            },
          ],
        });
      },
    );

    context.api.events.on("report-log-error", (logSessionPath: string) => {
      context.api.sendNotification({
        id: "report-log-error",
        type: "info",
        message: "Please report this on our issue tracker",
        actions: [
          {
            title: "View Log/Open issue tracker",
            action: () => {
              util.opn(VORTEX_ISSUE_TRACKER).catch(() => null);
              util.opn(logSessionPath).catch(() => null);
            },
          },
        ],
      });
    });

    nativeCrashCheck(context.api);
  });

  return true;
}

export default init;
