import { clearUIBlocker, setUIBlocker } from "../../actions";
import type {
  IExtensionApi,
  IExtensionContext,
} from "../../types/IExtensionContext";
import type { IGame } from "../../types/IGame";
import type { IState } from "../../types/IState";
import { ProcessCanceled, UserCanceled } from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import type { Normalize } from "../../util/getNormalizeFunc";
import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";
import makeReactive from "../../util/makeReactive";
import { activeGameId, gameName } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";

import { getGame } from "../gamemode_management/util/getGame";
import LinkingDeployment from "../mod_management/LinkingDeployment";
import type {
  IDeployedFile,
  IDeploymentMethod,
  IUnavailableReason,
} from "../mod_management/types/IDeploymentMethod";

import reducer from "./reducers";
import { remoteCode } from "./remoteCode";
import Settings from "./Settings";
import walk from "./walk";

import PromiseBB from "bluebird";
import type { TFunction } from "i18next";
import JsonSocket from "json-socket";
import * as net from "net";
import type * as os from "os";
import * as path from "path";
import * as semver from "semver";
import { generate as shortid } from "shortid";
import { runElevated } from "vortex-run";
import * as winapi from "winapi-bindings";
import { enableUserSymlinks } from "./actions";
import { getErrorMessageOrDefault } from "@vortex/shared";

const TASK_NAME = "Vortex Symlink Deployment";
const SCRIPT_NAME = "vortexSymlinkService.js";
const IPC_ID = "vortex_elevate_symlink";

function monitorConsent(onDisappeared: () => void): () => void {
  if (process.platform !== "win32") {
    // on non-windows platforms we don't need to do any of this.
    return;
  }

  const doCheck = () => {
    const consentExe = winapi
      .GetProcessList()
      .find((proc) => proc.exeFile === "consent.exe");
    if (consentExe === undefined) {
      // no consent.exe, assume it finished
      // still, wait a bit longer before doing anything so the "success" code has a chance to run
      nextCheck = setTimeout(onDisappeared, 5000);
    } else {
      // consent exe still running, bring its window to front and reschedule test
      const windows = winapi.GetProcessWindowList(consentExe.processID);
      windows.forEach((win) => winapi.SetForegroundWindow(win));

      nextCheck = setTimeout(doCheck, 1000);
    }
  };

  // give the first check a lot of time, who knows what the system has to do
  let nextCheck = setTimeout(doCheck, 5000);

  return () => {
    clearTimeout(nextCheck);
  };
}

type OnMessageCB = (conn: JsonSocket, message: string, payload: any) => void;

function startIPCServer(ipcPath: string, onMessage: OnMessageCB): net.Server {
  return net
    .createServer((connRaw) => {
      const conn = new JsonSocket(connRaw);

      conn
        .on("message", (data) => {
          const { message, payload } = data;
          onMessage(conn, message, payload);
        })
        .on("error", (err) => {
          log("error", "elevated code reported error", err);
        });
    })
    .listen(path.join("\\\\?\\pipe", ipcPath))
    .on("error", (err) => {
      log("error", "Failed to create ipc server", err);
    });
}

class DeploymentMethod extends LinkingDeployment {
  public compatible: string[] = ["symlink_activator"];

  public priority: number = 20;

  private mElevatedClient: any;
  private mQuitTimer: NodeJS.Timeout;
  private mCounter: number = 0;
  private mOpenRequests: {
    [num: number]: { resolve: () => void; reject: (err: Error) => void };
  };
  private mIPCServer: net.Server;
  private mDone: () => void;
  // private mWaitForUser: () => Promise<void>;
  private mOnReport: (report: string) => void;
  private mTmpFilePath: string;

  constructor(api: IExtensionApi) {
    super(
      "symlink_activator_elevated",
      "Symlink Deployment (Run as Administrator)",
      "Deploys mods by setting symlinks in the destination directory. " +
        "This is run as administrator and requires your permission every time we deploy.",
      true,
      api,
    );
    this.mElevatedClient = null;

    // this.mWaitForUser = () => new Promise<void>((resolve, reject) => api.sendNotification({
    //     type: 'info',
    //     message: 'Deployment requires elevation',
    //     noDismiss: true,
    //     actions: [{
    //       title: 'Elevate',
    //       action: dismiss => { dismiss(); resolve(); },
    //     }, {
    //       title: 'Cancel',
    //       action: dismiss => { dismiss(); reject(new UserCanceled()); },
    //     }],
    //   }));

    let lastReport: string;
    this.mOnReport = (report: string) => {
      if (report === lastReport) {
        return;
      }

      lastReport = report;

      if (report === "not-supported") {
        api.showErrorNotification(
          "Symlinks are not supported",
          "It appears symbolic links aren't supported between your mod staging folder and game " +
            "folder. On Windows, symbolic links only work on NTFS drives.",
          { allowReport: false },
        );
      } else {
        api.showErrorNotification("Unknown error", report);
      }
    };
  }

  public initEvents(api: IExtensionApi) {
    if (api.events !== undefined) {
      api.events.on("force-unblock-elevating", () => {
        this.endIPC("user canceled block");
      });
    }
  }

  public detailedDescription(t: TFunction): string {
    return t(
      "Symbolic links are special files containing a reference to another file. " +
        "They are supported directly by the low-level API of the operating system " +
        "so any application trying to open a symbolic link will actually open " +
        "the referenced file unless the application asks specifically to not be " +
        "redirected.\n" +
        "Advantages:\n" +
        " - good compatibility and availability\n" +
        " - can link across partitions (unlike hard links)\n" +
        " - an application that absolutely needs to know can recognize a symlink " +
        "(unlike hard links)\n" +
        "Disadvantages:\n" +
        " - some games and applications refuse to work with symbolic links for no " +
        "good reason.\n" +
        " - On windows you need admin rights to create a symbolic link, even when " +
        "your regular account has write access to source and destination.",
    );
  }

  public userGate(): PromiseBB<void> {
    // In the past, we used to block the user from deploying/purging his mods
    //  until he would give us consent to elevate permissions to do so.
    // That is a redundant anti-pattern as the elevation UI itself will already inform the user
    //  of this requirement and give him the opportunity to cancel or proceed with the deployment!
    //
    // Additionally - blocking the deployment behind a collapsible notification is extremely bad UX
    //  as it is not necessarily obvious to the user that we require him to click on the notification.
    // Finally, this will block the user from switching to other games while Vortex awaits for elevation
    //  causing the "Are you stuck?" overlay to appear and remain there, waiting for the user to click on an
    //  invisible notification button.
    //
    // I could add a Promise.race([this.waitForUser(), this.waitForElevation()]) to replace the mWaitForUser
    //  functor - but what's the point - if the user clicked deploy, he surely wants to elevate his instance
    //  as well. (And if not, he can always cancel the Windows API dialog!)
    return PromiseBB.resolve();
  }

  public prepare(
    dataPath: string,
    clean: boolean,
    lastActivation: IDeployedFile[],
    normalize: Normalize,
  ): PromiseBB<void> {
    this.mCounter = 0;
    this.mOpenRequests = {};
    return super.prepare(dataPath, clean, lastActivation, normalize);
  }

  public finalize(
    gameId: string,
    dataPath: string,
    installationPath: string,
  ): PromiseBB<IDeployedFile[]> {
    Object.keys(this.mOpenRequests).forEach((num) => {
      this.mOpenRequests[num].reject(new ProcessCanceled("unfinished"));
    });
    this.mOpenRequests = {};
    return this.closeServer()
      .then(() => this.startElevated())
      .tapCatch((err) => {
        log("info", "elevated process failed", { error: err.message });
        this.context.onComplete();
      })
      .then(() => super.finalize(gameId, dataPath, installationPath))
      .then((result) => this.stopElevated().then(() => result));
  }

  public isSupported(state: any, gameId?: string): IUnavailableReason {
    if (process.platform !== "win32") {
      return {
        description: (t) => t("Elevation not required on non-windows systems"),
      };
    }
    if (gameId === undefined) {
      gameId = activeGameId(state);
    }

    const game: IGame = getGame(gameId);

    if (
      game.details?.supportsSymlinks === false ||
      game.compatible?.symlinks === false
    ) {
      return { description: (t) => t("Game doesn't support symlinks") };
    }

    if (this.isGamebryoGame(gameId) || this.isUnsupportedGame(gameId)) {
      // Mods for this games use some file types that have issues working with symbolic links
      return {
        description: (t) =>
          t('Incompatible with "{{name}}".', {
            replace: {
              name: gameName(state, gameId),
            },
          }),
      };
    }
    if (
      this.ensureAdmin() &&
      process.env["FORCE_ALLOW_ELEVATED_SYMLINKING"] !== "true"
    ) {
      return {
        description: (t) =>
          t(
            "No need to use the elevated variant, use the regular symlink deployment",
          ),
      };
    }

    // unfortunately we can't test whether symlinks are supported on the filesystem if
    // creating a link requires elevation

    return undefined;
  }

  protected linkFile(
    linkPath: string,
    sourcePath: string,
    dirTags?: boolean,
  ): PromiseBB<void> {
    const dirName = path.dirname(linkPath);
    return this.ensureDir(dirName, dirTags)
      .then((created) =>
        !created
          ? // if the directory did exist, there is a chance the destination file already
            // exists
            fs
              .removeAsync(linkPath)
              .catch((err) =>
                err.code === "ENOENT"
                  ? PromiseBB.resolve()
                  : PromiseBB.reject(err),
              )
          : PromiseBB.resolve(),
      )
      .then(() =>
        this.emitOperation("link-file", {
          source: sourcePath,
          destination: linkPath,
        }),
      );
  }

  protected unlinkFile(linkPath: string): PromiseBB<void> {
    return this.emitOperation("remove-link", {
      destination: linkPath,
    });
  }

  protected purgeLinks(installPath: string, dataPath: string): PromiseBB<void> {
    let hadErrors = false;
    // purge by removing all symbolic links that point to a file inside
    // the install directory
    return this.startElevated()
      .then(() =>
        walk(dataPath, (iterPath: string, stats: fs.Stats) => {
          if (!stats.isSymbolicLink()) {
            return PromiseBB.resolve();
          }
          return fs
            .readlinkAsync(iterPath)
            .then((symlinkPath) =>
              path.relative(installPath, symlinkPath).startsWith("..")
                ? PromiseBB.resolve()
                : this.emitOperation("remove-link", { destination: iterPath }),
            )
            .catch((err) => {
              if (err.code === "ENOENT") {
                log("debug", "link already gone", {
                  iterPath,
                  error: err.message,
                });
              } else {
                hadErrors = true;
                log("error", "failed to remove link", {
                  iterPath,
                  error: err.message,
                });
              }
            });
        }),
      )
      .then(() => this.stopElevated())
      .then(() => {
        if (hadErrors) {
          const err = new Error(
            "Some files could not be purged, please check the log file",
          );
          err["attachLogOnReport"] = true;
          return PromiseBB.reject(err);
        } else {
          return PromiseBB.resolve();
        }
      });
  }

  protected isLink(linkPath: string, sourcePath: string): PromiseBB<boolean> {
    return (
      fs
        .readlinkAsync(linkPath)
        .then((symlinkPath) => symlinkPath === sourcePath)
        // readlink throws an "unknown" error if the file is no link at all. Super helpful...
        // this doesn't actually seem to be the case any more in electron 8, seems we now get
        // EINVAL
        .catch(() => false)
    );
  }

  protected canRestore(): boolean {
    return false;
  }

  private closeServer(): PromiseBB<void> {
    if (this.mIPCServer === undefined || this.mQuitTimer !== undefined) {
      return PromiseBB.resolve();
    }
    return new PromiseBB((resolve, reject) => {
      this.mIPCServer.close((err?: Error) => {
        // note: err may be undefined instead of null
        if (err) {
          // afaik the server having already been closed is the only situation that would
          // trigger an error here
          log("warn", "failed to close ipc connection", err);
        }
        this.mIPCServer = undefined;
        return resolve();
      });
    });
  }

  private ensureAdmin(): boolean {
    const userData = getVortexPath("userData");
    // any file we know exists
    const srcFile = path.join(userData, "Cookies");
    const destFile = path.join(userData, "__link_test");
    try {
      try {
        // ensure the dummy file wasn't left over from a previous test
        fs.removeSync(destFile);
      } catch (err) {
        // nop
      }
      fs.symlinkSync(srcFile, destFile);
      fs.removeSync(destFile);
      return true;
    } catch (err) {
      return false;
    }
  }

  private emit(message, payload) {
    if (this.mElevatedClient) {
      this.mElevatedClient.sendMessage({ message, payload });
    }
  }

  private emitAsync(command: string, args: any, requestNum: number) {
    return new PromiseBB<void>((resolve, reject) => {
      this.emit(command, { ...args, num: requestNum });
      this.mOpenRequests[requestNum] = { resolve, reject };
    });
  }

  private emitOperation(
    command: string,
    args: any,
    tries: number = 3,
  ): PromiseBB<void> {
    const requestNum = this.mCounter++;
    return this.emitAsync(command, args, requestNum)
      .timeout(5000)
      .catch(PromiseBB.TimeoutError, (err) => {
        if (this.mOpenRequests[requestNum] === undefined) {
          // this makes no sense, why would the timeout expire if the request
          // was resolved?
          log("warn", "request timed out after being fulfilled?");
          return PromiseBB.resolve();
        }

        delete this.mOpenRequests[requestNum];
        if (tries > 0) {
          log("debug", "retrying fs op", { command, args, tries });
          return this.emitOperation(command, args, tries - 1);
        } else {
          return PromiseBB.reject(err);
        }
      });
  }

  private startElevated(): PromiseBB<void> {
    return this.startElevatedImpl().tapCatch(() => {
      this.api.store.dispatch(clearUIBlocker("elevating"));
    });
  }

  private startElevatedImpl(): PromiseBB<void> {
    this.mOpenRequests = {};
    this.mDone = null;

    const state: IState = this.api.store.getState();
    const useTask = state.settings.workarounds.userSymlinks;

    // can't use dynamic id for the task
    const ipcPath: string = useTask ? IPC_ID : `${IPC_ID}_${shortid()}`;

    return new PromiseBB<void>((resolve, reject) => {
      let elevating = false;

      if (this.mQuitTimer !== undefined) {
        log("debug", "reusing symlink process");
        // if there is already an elevated process, just keep it around a bit longer
        clearTimeout(this.mQuitTimer);
        return resolve();
      }
      log("debug", "starting symlink process", ipcPath);

      this.mIPCServer = startIPCServer(
        ipcPath,
        (conn: JsonSocket, message: string, payload: any) => {
          if (message === "initialised") {
            const { pid } = payload;
            log("debug", "ipc connected", { pid });
            this.mElevatedClient = conn;
            this.api.store.dispatch(clearUIBlocker("elevating"));
            elevating = false;
            resolve();
          } else if (message === "completed") {
            const { err, num } = payload;
            const task = this.mOpenRequests[num];
            if (task !== undefined) {
              if (err !== null) {
                task.reject(err);
              } else {
                task.resolve();
              }
              delete this.mOpenRequests[num];
            } else {
              log("debug", "unexpected operation completed");
            }
            if (
              Object.keys(this.mOpenRequests).length === 0 &&
              this.mDone !== null
            ) {
              this.finish();
            }
          } else if (message === "log") {
            // tslint:disable-next-line:no-shadowed-variable
            const { level, message, meta } = payload;
            log(level, message, meta);
          } else if (message === "report") {
            this.mOnReport(payload);
          } else {
            log("error", "Got unexpected message", { message, payload });
          }
        },
      );

      if (!useTask) {
        elevating = true;
        this.api.store.dispatch(
          setUIBlocker(
            "elevating",
            "open-ext",
            'Please confirm the "User Access Control" dialog',
            true,
          ),
        );
        monitorConsent(() => {
          if (elevating) {
            // this is called if consent.exe disappeared but none of our "regular" code paths ran
            // which would have cancelled this timeout
            this.api.store.dispatch(clearUIBlocker("elevating"));
            this.endIPC("no init");
            /*
            this.api.showErrorNotification('Failed to run elevated process',
              'Symlinks on your system can only be created by an elevated process and your system '
              + 'just refused/failed to run the process elevated with no error message. '
              + 'Please check your system settings regarding User Access Control or use a '
              + 'different deployment method.', { allowReport: false });
              */
            reject(
              new ProcessCanceled(
                "Symlinks on your system can only be created by an elevated process and your system " +
                  "just refused/failed to run the process elevated with no error message. " +
                  "Please check your system settings regarding User Access Control or use a " +
                  "different deployment method.",
              ),
            );
          }
        });
      }

      const remoteProm = useTask
        ? PromiseBB.resolve()
        : PromiseBB.delay(0)
            .then(() => runElevated(ipcPath, remoteCode, {}))
            .tap((tmpPath) => {
              this.mTmpFilePath = tmpPath;
              log("debug", "started elevated process");
            })
            .tapCatch(() => {
              this.api.store.dispatch(clearUIBlocker("elevating"));
              elevating = false;
              log("error", "failed to run remote process");
              this.endIPC("starting remote process failed");
            });

      if (useTask) {
        try {
          winapi.RunTask(TASK_NAME);
        } catch (err) {
          const message = getErrorMessageOrDefault(err);
          this.api.showErrorNotification(
            "Failed to deploy using symlinks",
            "You have enabled the workaround for symlink deployment without elevation " +
              "(see Settings->Workarounds) and for unknown reasons it doesn't work.\n" +
              "You may be able to fix this by disabling and re-enabling the feature " +
              "but if that doesn't help there is probably some Windows setting " +
              "in your system or external software interfering with it that we're not aware of, " +
              "you will have to disable the workaround.\n" +
              "Unless you have an idea why your system may prevent Vortex from creating or running " +
              "scheduler tasks, please don't report this. We are aware of the problem " +
              "but we have no lead to investigate.\n" +
              "The error message was: {{error}}",
            {
              allowReport: false,
              replace: { error: message },
            },
          );
          return reject(new ProcessCanceled(message));
        }
      }

      return (
        remoteProm
          // Error 1223 is the current standard Windows system error code
          //  for ERROR_CANCELLED, which in this case is raised if the user
          //  selects to deny elevation when prompted.
          //  https://docs.microsoft.com/en-us/windows/desktop/debug/system-error-codes--1000-1299-
          .catch({ code: 5 }, () => reject(new UserCanceled()))
          .catch({ systemCode: 1223 }, () => reject(new UserCanceled()))
          // Just in case this is still used somewhere - doesn't look like it though.
          .catch({ errno: 1223 }, () => reject(new UserCanceled()))
          .catch((err) => reject(err))
      );
    });
  }

  private endIPC(reason: string) {
    log("debug", "terminating ipc connection", reason);
    try {
      this.mIPCServer?.close();
      this.mIPCServer = undefined;
    } catch (err) {
      log("warn", "Failed to close ipc server", {
        error: getErrorMessageOrDefault(err),
        reason,
      });
    }
  }

  private stopElevated() {
    return new PromiseBB<void>((resolve, reject) => {
      this.mDone = () => {
        resolve();
      };
      if (Object.keys(this.mOpenRequests).length === 0) {
        this.finish();
      }
    });
  }

  private finish() {
    log("debug", "finished");
    if (this.mQuitTimer !== undefined) {
      clearTimeout(this.mQuitTimer);
    }
    this.mQuitTimer = setTimeout(() => {
      log("debug", "closing symlink process");
      this.emit("quit", {});
      this.endIPC("already closed");

      this.mElevatedClient = null;
      this.mQuitTimer = undefined;
    }, 5000);

    if (this.mTmpFilePath !== undefined) {
      try {
        fs.removeSync(this.mTmpFilePath);
        this.mTmpFilePath = undefined;
      } catch (err) {
        // nop
      }
    }

    this.mDone();
  }

  private isGamebryoGame(gameId: string): boolean {
    return (
      [
        "morrowind",
        "oblivion",
        "skyrim",
        "enderal",
        "skyrimse",
        "skyrimvr",
        "fallout4",
        "fallout4vr",
        "fallout3",
        "falloutnv",
      ].indexOf(gameId) !== -1
    );
  }

  private isUnsupportedGame(gameId: string): boolean {
    const unsupportedGames =
      process.platform === "win32"
        ? ["nomanssky", "stateofdecay", "factorio"]
        : ["nomanssky", "stateofdecay"];

    return unsupportedGames.indexOf(gameId) !== -1;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerDeploymentMethod: (deployment: IDeploymentMethod) => void;
}

// tslint:disable-next-line:variable-name
const __req = undefined; // dummy

// copy&pasted from elevatedMain
function baseFunc(
  moduleRoot: string,
  ipcPath: string,
  main: (ipc, req: NodeRequireFunction) => void | PromiseBB<void>,
) {
  const handleError = (error: any) => {
    // tslint:disable-next-line:no-console
    console.error("Elevated code failed", error.stack);
  };
  process.on("uncaughtException", handleError);
  process.on("unhandledRejection", handleError);
  // tslint:disable-next-line:no-shadowed-variable
  (module as any).paths.push(moduleRoot);
  const imp = {
    net: __req("net"),
    JsonSocket: __req("json-socket"),
    path: __req("path"),
  };

  const client = new imp.JsonSocket(new imp.net.Socket());
  client.connect(imp.path.join("\\\\?\\pipe", ipcPath));

  client
    .on("connect", () => {
      const res = main(client, __req);
      // bit of a hack but the type "bluebird" isn't known in this context
      if (res?.["catch"] !== undefined) {
        (res as any)
          .catch((error) => {
            client.emit("error", error.message);
          })
          .finally(() => {
            client.end();
            process.exit(0);
          });
      }
    })
    .on("close", () => {
      process.exit(0);
    })
    .on("error", (err) => {
      if (err.code !== "EPIPE") {
        // will anyone ever see this?
        // tslint:disable-next-line:no-console
        console.error("Connection failed", err.message);
      }
    });
}

function makeScript(args: any): string {
  const projectRoot = getVortexPath("modules_unpacked").split("\\").join("/");

  let funcBody = baseFunc.toString();
  funcBody =
    "const __req = require;" +
    funcBody.slice(funcBody.indexOf("{") + 1, funcBody.lastIndexOf("}"));
  let prog: string = `
        let moduleRoot = '${projectRoot}';\n
        let ipcPath = '${IPC_ID}';\n
      `;

  if (args !== undefined) {
    for (const argKey of Object.keys(args)) {
      if (args.hasOwnProperty(argKey)) {
        prog += `let ${argKey} = ${JSON.stringify(args[argKey])};\n`;
      }
    }
  }

  prog += `
        let main = ${remoteCode.toString()};\n
        ${funcBody}\n
      `;
  return prog;
}

function installTask(scriptPath: string) {
  const taskName = TASK_NAME;

  const ipcPath = `ipc_${shortid()}`;

  const ipcServer: net.Server = startIPCServer(
    ipcPath,
    (conn, message: string, payload) => {
      if (message === "log") {
        log(payload.level, payload.message, payload.meta);
      } else if (message === "quit") {
        ipcServer.close((err) => {
          if (err) {
            log("warn", "failed to close ipc connection", err);
          }
        });
      }
    },
  );

  const exePath = process.execPath;
  const exeArgs = exePath.endsWith("electron.exe")
    ? getVortexPath("package")
    : "";

  return runElevated(
    ipcPath,
    (ipc, req) => {
      const winapiRemote: typeof winapi = req("winapi-bindings");
      const osRemote: typeof os = req("os");
      try {
        winapiRemote.CreateTask(taskName, {
          registrationInfo: {
            Author: "Vortex",
            Description:
              "This task is required for Vortex to create symlinks without elevation." +
              "Do not change anything unless you really know what you're doing.",
          },
          user: `${osRemote.hostname()}\\${osRemote.userInfo().username}`,
          taskSettings: { AllowDemandStart: true },
          principal: { RunLevel: "highest" } as any,
          actions: [
            {
              Path: exePath,
              Arguments: `${exeArgs} --run ${scriptPath}`,
            },
          ],
        });
      } catch (err) {
        ipc.sendMessage({
          message: "log",
          payload: {
            level: "error",
            message: "Failed to create task",
            meta: err,
          },
        });
      }
      ipc.sendMessage({ message: "quit" });
    },
    { scriptPath, taskName, exePath, exeArgs },
  ).catch((err) =>
    err["nativeCode"] === 1223 || err["systemCode"] === 1223
      ? PromiseBB.reject(new UserCanceled())
      : PromiseBB.reject(err),
  );
}

function ensureTaskEnabled(api: IExtensionApi, delayed: boolean) {
  const scriptPath = path.join(getVortexPath("userData"), SCRIPT_NAME);

  return fs.writeFileAsync(scriptPath, makeScript({})).then(() => {
    if (findTask() !== undefined) {
      // not checking if the task is actually set up correctly
      // (proper path and arguments for the action) so if we change any of those we
      // need migration code. If the user changes the task, screw them.
      return PromiseBB.resolve();
    }

    if (delayed) {
      api.sendNotification({
        type: "info",
        message: "Symlink elevation workaround disabled",
        noDismiss: true,
        actions: [
          {
            title: "Disable Workaround",
            action: (dismiss) => {
              api.store.dispatch(enableUserSymlinks(false));
              dismiss();
            },
          },
          {
            title: "Repair",
            action: (dismiss) => {
              installTask(scriptPath);
              dismiss();
            },
          },
        ],
      });
    } else {
      installTask(scriptPath);
    }
  });
}

function tasksSupported() {
  try {
    winapi.GetTasks();
    return null;
  } catch (err) {
    const message = getErrorMessageOrDefault(err);
    log("info", "windows tasks api failed", message);
    return message;
  }
}

function findTask() {
  if (process.platform !== "win32") {
    return undefined;
  }
  try {
    return winapi.GetTasks().find((task) => task.Name === TASK_NAME);
  } catch (err) {
    log("warn", "failed to list windows tasks", getErrorMessageOrDefault(err));
    return undefined;
  }
}

function removeTask(): PromiseBB<void> {
  const ipcPath = `ipc_${shortid()}`;
  const ipcServer: net.Server = startIPCServer(
    ipcPath,
    (conn, message: string, payload) => {
      if (message === "log") {
        log(payload.level, payload.message, payload.meta);
      } else if (message === "quit") {
        ipcServer.close((err) => {
          if (err) {
            log("warn", "failed to close ipc connection", err);
          }
        });
      }
    },
  );

  const taskName = TASK_NAME;

  return runElevated(
    ipcPath,
    (ipc, req) => {
      const winapiRemote: typeof winapi = req("winapi-bindings");
      winapiRemote.DeleteTask(taskName);
      ipc.sendMessage({ message: "quit" });
    },
    { taskName },
  ).catch((err) =>
    err["nativeCode"] === 1223 || err["systemCode"] === 1223
      ? PromiseBB.reject(new UserCanceled())
      : PromiseBB.reject(err),
  );
}

function ensureTaskDeleted(
  api: IExtensionApi,
  delayed: boolean,
): PromiseBB<void> {
  if (findTask() === undefined) {
    return PromiseBB.resolve();
  }

  if (delayed) {
    api.sendNotification({
      type: "info",
      message: "Symlink elevation workaround not fully disabled",
      noDismiss: true,
      actions: [
        {
          title: "Clean up",
          action: (dismiss) => {
            removeTask().catch((err) => {
              api.showErrorNotification("Failed to disable task", err, {
                allowReport: !(err instanceof UserCanceled),
              });
            });
            dismiss();
          },
        },
      ],
    });
    // ensureTaskDeleted returns immediately even though nothing has been done yet
    return PromiseBB.resolve();
  } else {
    return removeTask();
  }
}

function ensureTask(
  api: IExtensionApi,
  enabled: boolean,
  delayed: boolean,
): PromiseBB<void> {
  if (enabled) {
    return ensureTaskEnabled(api, delayed)
      .catch((err) => {
        if (!(err instanceof UserCanceled)) {
          api.showErrorNotification("Failed to create task", err);
        }
        api.store.dispatch(enableUserSymlinks(false));
      })
      .then(() => null);
  } else {
    return ensureTaskDeleted(api, delayed)
      .catch((err) => {
        if (!(err instanceof UserCanceled)) {
          api.showErrorNotification("Failed to remove task", err);
        }
      })
      .then(() => null);
  }
}

function migrate(api: IExtensionApi, oldVersion: string) {
  if (
    process.platform === "win32" &&
    semver.satisfies(oldVersion, ">=1.2.0  <1.2.10") &&
    findTask() !== undefined
  ) {
    api.sendNotification({
      type: "warning",
      title:
        'Due to a bug you have to disable and re-enable the Workaround "Allow Symlinks without elevation"',
      message: "I am sorry for the inconvenience",
      displayMS: null,
    });
  }
  return PromiseBB.resolve();
}

const localState: { symlinkRight: boolean } = makeReactive({
  symlinkRight: false,
});

function giveSymlinkRight(enable: boolean) {
  const sid = winapi.GetUserSID();

  const ipcPath = `ipc_${shortid()}`;

  log("info", "switching symlink privilege", {
    sid,
    from: localState.symlinkRight,
    to: enable,
  });
  localState.symlinkRight = enable;

  const ipcServer: net.Server = startIPCServer(
    ipcPath,
    (conn, message: string, payload) => {
      if (message === "log") {
        log(payload.level, payload.message, payload.meta);
      } else if (message === "quit") {
        ipcServer.close((err) => {
          if (err) {
            log("warn", "failed to close ipc connection", err);
          }
        });
        if (payload !== undefined) {
          localState.symlinkRight = payload;
        }
      }
    },
  );

  runElevated(
    ipcPath,
    (ipc, req) => {
      const winapiRemote: typeof winapi = req("winapi-bindings");
      ipc.sendMessage({
        message: "log",
        payload: {
          level: "info",
          message: `will ${enable ? "enable" : "disable"} privilege`,
        },
      });

      const func = enable
        ? winapiRemote.AddUserPrivilege
        : winapiRemote.RemoveUserPrivilege;
      try {
        func(sid, "SeCreateSymbolicLinkPrivilege");
        ipc.sendMessage({
          message: "log",
          payload: {
            level: "info",
            message: "call successful",
          },
        });
        const enabled = winapiRemote
          .GetUserPrivilege(sid)
          .includes("SeCreateSymbolicLinkPrivilege");
        ipc.sendMessage({
          message: "log",
          payload: {
            level: "info",
            message: "verification",
            meta: { expected: enable, actual: enabled },
          },
        });

        ipc.sendMessage({ message: "quit", payload: enabled });
      } catch (err) {
        ipc.sendMessage({
          message: "log",
          payload: {
            level: "error",
            message: "Failed to change privilege",
            meta: err,
          },
        });

        ipc.sendMessage({ message: "quit" });
      }
    },
    { sid, enable },
  ).catch((err) =>
    err["nativeCode"] === 1223 || err["systemCode"] === 1223
      ? PromiseBB.reject(new UserCanceled())
      : PromiseBB.reject(err),
  );
}

function init(context: IExtensionContextEx): boolean {
  context.registerReducer(["settings", "workarounds"], reducer);

  const method = new DeploymentMethod(context.api);
  context.registerDeploymentMethod(method);

  if (process.platform === "win32") {
    context.registerSettings("Workarounds", Settings, () => ({
      supported: tasksSupported(),
      localState,
      onSymlinksPrivilege: (enable: boolean) => giveSymlinkRight(enable),
    }));
  }

  context.registerMigration((oldVersion) => migrate(context.api, oldVersion));

  context.once(() => {
    method.initEvents(context.api);

    if (process.platform === "win32") {
      const privileges: winapi.Privilege[] = winapi.CheckYourPrivilege();
      localState.symlinkRight = privileges.includes(
        "SeCreateSymbolicLinkPrivilege",
      );

      const userSymlinksPath = ["settings", "workarounds", "userSymlinks"];
      context.api.onStateChange(userSymlinksPath, (prev, current) => {
        ensureTask(context.api, current, false);
      });
      const state = context.api.store.getState();
      const userSymlinks = getSafe(state, userSymlinksPath, false);
      return ensureTask(context.api, userSymlinks, true);
    }
  });

  return true;
}

export default init;
