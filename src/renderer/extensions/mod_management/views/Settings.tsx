import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import PromiseBB from "bluebird";
import * as path from "path";
import * as React from "react";
import {
  Alert,
  Button as BSButton,
  ControlLabel,
  FormControl,
  FormGroup,
  HelpBlock,
  InputGroup,
  Jumbotron,
  Modal,
  Panel,
  ProgressBar,
} from "react-bootstrap";
import * as winapi from "winapi-bindings";

import type {
  DialogActions,
  DialogType,
  IDialogContent,
  IDialogResult,
} from "../../../types/IDialog";
import type { InstallPathMode, IState } from "../../../types/IState";
import type { ValidationState } from "../../../types/ITableAttribute";
import type { IDiscoveryResult } from "../../gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../../gamemode_management/types/IGameStored";
import type { IDeploymentMethod } from "../types/IDeploymentMethod";

import { showDialog } from "../../../actions/notifications";
import { ComponentEx, connect, translate } from "../../../controls/ComponentEx";
import EmptyPlaceholder from "../../../controls/EmptyPlaceholder";
import FlexLayout from "../../../controls/FlexLayout";
import Icon from "../../../controls/Icon";
import More from "../../../controls/More";
import Spinner from "../../../controls/Spinner";
import Toggle from "../../../controls/Toggle";
import { Button } from "../../../controls/TooltipControls";
import {
  CleanupFailedException,
  InsufficientDiskSpace,
  NotFound,
  ProcessCanceled,
  TemporaryError,
  UnsupportedOperatingSystem,
  UserCanceled,
} from "../../../util/CustomErrors";
import { withContext } from "../../../util/errorHandling";
import * as fs from "../../../util/fs";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import getVortexPath from "../../../util/getVortexPath";
import { log } from "../../../util/log";
import { showError } from "../../../util/message";
import opn from "../../../util/opn";
import * as selectors from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import {
  cleanFailedTransfer,
  testPathTransfer,
  transferPath,
} from "../../../util/transferPath";
import {
  ciEqual,
  isChildPath,
  isPathValid,
  isReservedDirectory,
} from "../../../util/util";
import { getErrorMessageOrDefault } from "@vortex/shared";
import {
  currentGame,
  currentGameDiscovery,
} from "../../gamemode_management/selectors";
import { setDeploymentNecessary } from "../actions/deployment";
import {
  setActivator,
  setInstallPath,
  setInstallPathMode,
} from "../actions/settings";
import { setTransferMods } from "../actions/transactions";
import { modPathsForGame } from "../selectors";
import { STAGING_DIR_TAG } from "../stagingDirectory";
import getText from "../texts";
import { getSupportedActivators } from "../util/deploymentMethods";
import { NoDeployment } from "../util/exceptions";
import getInstallPath, { getInstallPathPattern } from "../util/getInstallPath";

interface IBaseProps {
  activators: IDeploymentMethod[];
}

interface IConnectedProps {
  game: IGameStored;
  discovery: IDiscoveryResult;
  gameMode: string;
  installPath: string;
  downloadsPath: string;
  currentActivator: string;
  modActivity: string[];
  modPaths: { [modType: string]: string };
  instanceId: string;
  installPathMode: InstallPathMode;
  suggestInstallPathDirectory: string;
  useModernLayout: boolean;
}

interface IActionProps {
  onSetInstallPath: (gameMode: string, path: string) => void;
  onSetActivator: (gameMode: string, id: string) => void;
  onSetTransfer: (gameMode: string, dest: string) => void;
  onShowDialog: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
  ) => PromiseBB<IDialogResult>;
  onShowError: (
    message: string,
    details: string | Error | any,
    allowReport?: boolean,
    isBBCode?: boolean,
  ) => void;
  onSetInstallPathMode: (installPathMode: InstallPathMode) => void;
}

interface IComponentState {
  installPath: string;
  busy: string;
  progress: number;
  progressFile: string;
  supportedActivators: IDeploymentMethod[];
  currentActivator: string;
  changingActivator: boolean;
  appPath: string;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

const nop = () => undefined;

class Settings extends ComponentEx<IProps, IComponentState> {
  private mLastFileUpdate: number = 0;
  constructor(props: IProps) {
    super(props);
    this.initState({
      busy: undefined,
      progress: 0,
      progressFile: undefined,
      supportedActivators: [],
      currentActivator: props.currentActivator,
      installPath: props.installPath,
      changingActivator: false,
      appPath: undefined,
    });
  }

  public componentDidMount() {
    const activators = this.supportedActivators();
    this.nextState.supportedActivators = activators;
    if (
      activators.find((act) => act.id === this.state.currentActivator) ===
      undefined
    ) {
      // Configured activator isn't supported anymore, update selection.
      // Some games such as Skyrim may have no supported activators at all,
      //  in which case we set the current activator to undefined.
      this.nextState.currentActivator =
        activators.length > 0 ? activators[0].id : undefined;
    }

    // Load the app path for validation
    window.api.app.getAppPath().then((appPath) => {
      // In asar builds getAppPath returns the path of the asar so need to go up 2 levels
      // (resources/app.asar)
      if (path.basename(appPath) === "app.asar") {
        appPath = path.dirname(path.dirname(appPath));
      }
      this.nextState.appPath = appPath;
    });
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.installPath !== newProps.installPath) {
      this.nextState.installPath = newProps.installPath;
    }
  }

  public componentDidUpdate(prevProps: IProps, prevState: IComponentState) {
    if (
      this.props.gameMode !== prevProps.gameMode ||
      this.props.installPath !== prevProps.installPath
    ) {
      this.nextState.supportedActivators = this.supportedActivators();
      this.nextState.currentActivator = this.props.currentActivator;
    }
  }

  public render(): JSX.Element {
    const { t, discovery, game, installPathMode, suggestInstallPathDirectory } =
      this.props;
    const { currentActivator, progress, progressFile, supportedActivators } =
      this.state;

    const panels: React.ReactNode[] = [
      <Panel key="defaults">
        <Panel.Body>
          <ControlLabel>{t("Defaults")}</ControlLabel>

          <Toggle
            checked={installPathMode === "suggested"}
            onToggle={this.toggleInstallPathMode}
          >
            {t("Automatically use suggested path for staging folder")}

            <More id="staging_path_mode" name="Staging Path Mode">
              {t(
                "Usually, when you first manage a game, the staging folder is initially set to be in " +
                  '"c:\\Users\\<username>\\AppData\\Roaming\\Vortex\\<game>" because that\'s ' +
                  "guaranteed to exist and have the necessary file permissions set up.\n\n" +
                  "If you enable this option, it will instead put the staging folder on the same drive " +
                  "as the primary mod folder of each game, in <drive>:\\{{suggestionPattern}}\\<game id>.\n" +
                  "This should usually work fine for most users and ensures deployment is possible.",
                {
                  replace: {
                    suggestionPattern: suggestInstallPathDirectory,
                  },
                },
              )}
            </More>
          </Toggle>
        </Panel.Body>
      </Panel>,
    ];

    if (game !== undefined && discovery?.path !== undefined) {
      let gameName = getSafe(
        discovery,
        ["name"],
        getSafe(game, ["name"], undefined),
      );
      if (gameName !== undefined) {
        gameName = gameName
          .split("\t")
          .map((part) => t(part))
          .join(" ");
      }

      panels.push(
        <Panel key="staging">
          <Panel.Body>
            {this.renderPathCtrl(
              t("Mod Staging Folder ({{name}})", {
                replace: { name: gameName },
              }),
              supportedActivators,
            )}

            <Modal show={this.state.busy !== undefined} onHide={nop}>
              <Modal.Body>
                <Jumbotron>
                  <div className="container">
                    <h2>{this.state.busy}</h2>

                    {progressFile !== undefined ? <p>{progressFile}</p> : null}

                    <ProgressBar now={progress} style={{ height: "1.5em" }} />
                  </div>
                </Jumbotron>
              </Modal.Body>
            </Modal>
          </Panel.Body>
        </Panel>,
        <Panel key="deployment">
          <Panel.Body>
            <ControlLabel>
              {t("Deployment Method")}

              <More id="more-deploy" name={t("Deployment")}>
                {getText("deployment", t)}
              </More>
            </ControlLabel>

            {this.renderActivators(supportedActivators, currentActivator)}
          </Panel.Body>
        </Panel>,
      );
    } else if (!this.props.useModernLayout) {
      panels.push(
        <EmptyPlaceholder
          icon="settings"
          subtext={t(
            "Most settings here can be configured for each game individually.",
          )}
          text={t(
            "This screen will have more options once you start managing a game.",
          )}
        />,
      );
    }

    return (
      // Prevent default submit event for the form as it will
      //  cause Vortex to refresh (same thing as pressing F5).
      <form onSubmit={this.submitEvt}>
        {...panels.reduce<React.ReactNode[]>((prev, panel, idx) => {
          if (idx > 0) {
            prev.push(<hr />);
          }
          prev.push(panel);
          return prev;
        }, [])}
      </form>
    );
  }

  private submitEvt = (evt) => {
    evt.preventDefault();
  };

  private toggleInstallPathMode = () => {
    const { installPathMode, onSetInstallPathMode } = this.props;
    onSetInstallPathMode(
      installPathMode === "userData" ? "suggested" : "userData",
    );
  };

  /**
   * return only those activators that are supported based on the current state
   *
   * @param {*} state
   * @returns {IDeploymentMethod[]}
   */
  private supportedActivators(): IDeploymentMethod[] {
    return getSupportedActivators(this.context.api.store.getState());
  }

  private pathsChanged() {
    const { gameMode } = this.props;
    return !ciEqual(
      getInstallPath(this.props.installPath, gameMode),
      getInstallPath(this.state.installPath, gameMode),
    );
  }

  private transferPath() {
    const { t, gameMode, onSetTransfer, onShowDialog } = this.props;
    const oldPath = getInstallPath(this.props.installPath, gameMode);
    const newPath = getInstallPath(this.state.installPath, gameMode);

    return withContext(
      "Transferring Staging",
      `from ${oldPath} to ${newPath}`,
      () =>
        fs
          .statAsync(oldPath)
          .catch((err) => {
            // The initial mods staging folder is missing! - this may be a valid case if:
            //  1. HDD or removable media is faulty or has become unseated and is
            //  no longer detectable by the OS.
            //  2. Source folder was located on a network drive which is no longer available.
            //  3. User has changed drive letter for whatever reason.
            //
            //  Currently we have confirmed that the error code will be set to "UNKNOWN"
            //  for all these cases, but we may have to add other error codes if different
            //  error cases pop up.
            log("warn", "Transfer failed - missing source directory", err);
            return ["ENOENT", "UNKNOWN"].indexOf(err.code) !== -1
              ? PromiseBB.resolve(undefined)
              : PromiseBB.reject(err);
          })
          .then((stats) => {
            const queryReset =
              stats !== undefined
                ? PromiseBB.resolve(false)
                : onShowDialog(
                    "question",
                    "Missing staging folder",
                    {
                      bbcode:
                        "Vortex is unable to find your current mods staging folder. " +
                        "This can happen when: <br />" +
                        "1. You or an external application removed this folder.<br />" +
                        "2. Your HDD/removable drive became faulty or unseated.<br />" +
                        "3. The staging folder was located on a network drive which has been " +
                        "disconnected for some reason.<br /><br />" +
                        "Please diagnose your system and ensure that the source folder is detectable " +
                        "by your operating system.<br /><br />" +
                        'Alternatively, if you want to force Vortex to "re-initialize" your staging ' +
                        "folder at the destination you have chosen, Vortex can do this for you but " +
                        "note that the folder will be empty as nothing will be transferred inside it!",
                    },
                    [{ label: "Cancel" }, { label: "Reinitialize" }],
                  ).then((result) =>
                    result.action === "Cancel"
                      ? PromiseBB.reject(new UserCanceled())
                      : PromiseBB.resolve(true),
                  );

            return queryReset.then((didReset) => {
              onSetTransfer(gameMode, newPath);
              return transferPath(
                oldPath,
                newPath,
                (from: string, to: string, progress: number) => {
                  log("debug", "transfer staging", { from, to });
                  if (progress > this.state.progress) {
                    this.nextState.progress = progress;
                  }
                  if (
                    this.state.progressFile !== from &&
                    Date.now() - this.mLastFileUpdate > 1000
                  ) {
                    this.nextState.progressFile = path.basename(from);
                  }
                },
              ).catch({ code: "ENOENT" }, (err) =>
                didReset ? PromiseBB.resolve() : PromiseBB.reject(err),
              );
            });
          }),
    );
  }

  private applyPaths = (normalize: (input: string) => string) => {
    const {
      t,
      discovery,
      gameMode,
      onSetInstallPath,
      onShowDialog,
      onShowError,
      onSetTransfer,
    } = this.props;

    if (discovery === undefined || discovery.path === undefined) {
      return onShowDialog(
        "error",
        "Not discovered",
        {
          text:
            "The active game is not discovered correctly. If you have an idea what " +
            "led to this, please report.",
        },
        [{ label: "Close" }],
      );
    }

    const newInstallPath: string = getInstallPath(
      this.state.installPath,
      gameMode,
    );
    const oldInstallPath: string = getInstallPath(
      this.props.installPath,
      gameMode,
    );
    log("info", "changing staging directory", {
      from: oldInstallPath,
      to: newInstallPath,
    });

    const vortexPath = getVortexPath("application");

    try {
      const statNew = fs.statSync(newInstallPath, { bigint: true });
      const statOld = fs.statSync(oldInstallPath, { bigint: true });
      if (statNew.ino === statOld.ino) {
        return onShowDialog(
          "error",
          "Invalid path selected",
          {
            text: "The path you selected refers to the same directory on disk as the existing one.",
          },
          [{ label: "Close" }],
        );
      }
    } catch (err) {
      // new directory doesn't exist. good
    }

    if (isReservedDirectory(newInstallPath)) {
      return onShowDialog(
        "error",
        "Invalid path selected",
        {
          text:
            "You have selected an invalid location for your staging folder " +
            "It would become impossible for Vortex to move your staging folder " +
            "anywhere else without attempting to move the entire contents of the " +
            "selected directory alongside it.",
        },
        [{ label: "Close" }],
      );
    }

    if (isChildPath(newInstallPath, vortexPath, normalize)) {
      return onShowDialog(
        "error",
        "Invalid path selected",
        {
          text:
            "You can not put mods into the vortex application directory. " +
            "This directory gets removed during updates so you would lose all your " +
            "files on the next update.",
        },
        [{ label: "Close" }],
      );
    }

    if (isChildPath(newInstallPath, discovery.path, normalize)) {
      return onShowDialog(
        "error",
        "Invalid path selected",
        {
          text:
            "You can not put mods into the game directory. " +
            "This directory is under the control of the game " +
            "(and potentially Steam or similar) " +
            "so your mods might be deleted or moved or otherwise damaged by " +
            "foreign software.\n" +
            "Please choose a separate folder for staging folder, one that no other " +
            "application uses.",
        },
        [{ label: "Close" }],
      );
    }

    if (isChildPath(oldInstallPath, newInstallPath, normalize)) {
      return onShowDialog(
        "error",
        "Invalid path selected",
        {
          text:
            "You can't change the staging folder to be the parent of the old folder. " +
            "This is because the new staging folder has to be empty and it isn't " +
            "empty if it contains the current staging folder.\n\n" +
            'If your current staging folder is "{USERDATA}\\{game}\\mods\\foobar"\n' +
            'and you want it to be "{USERDATA}\\{game}\\mods"\n' +
            'you first have to set it to something like "{USERDATA}\\{game}\\mods_temp"\n' +
            'and then you can change it to "{USERDATA}\\{game}\\mods".',
        },
        [{ label: "Close" }],
      );
    }

    const notEnoughDiskSpace = () => {
      return onShowDialog(
        "error",
        "Insufficient disk space",
        {
          text:
            "You do not have enough disk space to move the staging folder to your " +
            "proposed destination folder.\n\n" +
            "Please select a different destination or free up some space and try again!",
        },
        [{ label: "Close" }],
      );
    };

    // it's possible that old and new path indicate the same directory but are still different,
    // e.g. if the old path contained a variable (like {game}) and the new one has the game name
    // written out. In this case we update the setting without purging or moving anything
    const doPurge = () =>
      oldInstallPath !== newInstallPath
        ? // ignore if there is no deployment method because in that case there is nothing to purge
          this.purgeActivation().catch(NoDeployment, () => PromiseBB.resolve())
        : PromiseBB.resolve();

    this.nextState.progress = 0;
    this.nextState.busy = t("Calculating required disk space");
    let deleteOldDestination = true;
    return testPathTransfer(oldInstallPath, newInstallPath)
      .then(() => fs.ensureDirAsync(newInstallPath))
      .then(() => this.checkTargetEmpty(oldInstallPath, newInstallPath))
      .then(() => {
        this.nextState.busy = t("Purging previous deployment");
        return doPurge();
      })
      .then(() => {
        if (oldInstallPath !== newInstallPath) {
          this.nextState.busy = t("Moving mod staging folder");
          return this.transferPath();
        } else {
          return PromiseBB.resolve();
        }
      })
      .then(() => {
        onSetTransfer(gameMode, undefined);
        onSetInstallPath(gameMode, this.state.installPath);
      })
      .catch(TemporaryError, (err) => {
        onShowError("Failed to move directories, please try again", err, false);
      })
      .catch(UserCanceled, () => null)
      .catch(CleanupFailedException, (err) => {
        deleteOldDestination = false;
        onSetTransfer(gameMode, undefined);
        onSetInstallPath(gameMode, this.state.installPath);
        onShowDialog(
          "info",
          "Cleanup failed",
          {
            bbcode: t(
              "The mods staging folder has been copied [b]successfully[/b] to " +
                "your chosen destination!<br />" +
                "Clean-up of the old staging folder has been cancelled.<br /><br />" +
                "Old staging folder: [url]{{thePath}}[/url]",
              { replace: { thePath: oldInstallPath } },
            ),
          },
          [{ label: "Close", action: () => PromiseBB.resolve() }],
        );

        if (!(err.errorObject instanceof UserCanceled)) {
          this.context.api.showErrorNotification(
            "Clean-up failed",
            err.errorObject,
          );
        }
      })
      .catch(InsufficientDiskSpace, () => notEnoughDiskSpace())
      .catch(UnsupportedOperatingSystem, () =>
        onShowError(
          "Unsupported operating system",
          "This functionality is currently unavailable for your operating system!",
          false,
        ),
      )
      .catch(NotFound, () =>
        onShowError(
          "Invalid destination",
          "The destination partition you selected is invalid - please choose a different " +
            "destination",
          false,
        ),
      )
      .catch((err) => {
        if (err !== null) {
          if (err.code === "EPERM") {
            onShowError(
              "Directories are not writable",
              "You need to select directories that the current user account can write to!",
              false,
            );
          } else if (err.code === "EINVAL") {
            onShowError("Invalid path", err.message, false);
          } else if (err.code === "EIO") {
            // Input/Output file operations have been interrupted.
            //  this is not a bug in Vortex but rather a hardware/networking
            //  issue (depending on the user's setup).
            onShowError(
              "File operations interrupted",
              "Input/Output file operations have been interrupted. This is not a bug in Vortex, " +
                "but rather a problem with your environment!<br /><br />" +
                "Possible reasons behind this issue:<br />" +
                "1. Your HDD/Removable drive has become unseated during transfer.<br />" +
                "2. File operations were running on a network drive and said drive has become " +
                "disconnected for some reason (Network hiccup?)<br />" +
                "3. An overzealous third party tool (possibly Anti-Virus or virus) " +
                "which is blocking Vortex from completing its operations.<br />" +
                "4. A faulty HDD/Removable drive.<br /><br />" +
                "Please test your environment and try again once you've confirmed it's fixed.",
              false,
              true,
            );
          } else if (err.code === "UNKNOWN" && err?.["nativeCode"] === 1392) {
            // The file or directory is corrupted and unreadable.
            onShowError(
              "Failed to move directories",
              t(
                "Vortex has encountered a corrupted and unreadable file/directory " +
                  "and is unable to complete the transfer. Vortex was attempting " +
                  'to move the following file/directory: "{{culprit}}" when your operating system ' +
                  "raised the error. Please test your environment and try again once you've confirmed it's fixed.",
                { replace: { culprit: err.path } },
              ),
              false,
            );
          } else {
            onShowError(
              "Failed to move directories",
              err,
              !(err instanceof ProcessCanceled),
            );
          }
        }
      })
      .finally(() => {
        const state = this.context.api.store.getState();
        // Any transfers would've completed at this point.
        //  Check if we still have the transfer state populated,
        //  if it is - that means that the user has cancelled the transfer,
        //  we need to cleanup.
        const pendingTransfer: string[] = [
          "persistent",
          "transactions",
          "transfer",
          gameMode,
        ];
        if (
          getSafe(state, pendingTransfer, undefined) !== undefined &&
          deleteOldDestination
        ) {
          return cleanFailedTransfer(newInstallPath)
            .then(() => {
              onSetTransfer(gameMode, undefined);
              this.nextState.busy = undefined;
            })
            .catch(UserCanceled, () => {
              this.nextState.busy = undefined;
            })
            .catch((err) => {
              this.nextState.busy = undefined;
              if (err.code === "ENOENT") {
                // Folder is already gone, that's fine.
                onSetTransfer(gameMode, undefined);
              } else if (err.code === "EPERM") {
                onShowError(
                  "Destination folder is not writable",
                  "Vortex is unable to clean up " +
                    "the destination folder due to a permissions issue.",
                  false,
                );
              } else {
                onShowError("Transfer clean-up failed", err, true);
              }
            });
        } else {
          this.nextState.busy = undefined;
        }
      });
  };

  private checkTargetEmpty(oldInstallPath: string, newInstallPath: string) {
    let queue = PromiseBB.resolve();
    let fileCount = 0;
    let hasStagingTag: boolean = false;
    let tagInstance: string;
    if (oldInstallPath !== newInstallPath) {
      queue = queue
        .then(() => fs.readdirAsync(newInstallPath))
        .then((files) => {
          fileCount += files.length;
          if (!hasStagingTag && files.includes(STAGING_DIR_TAG)) {
            hasStagingTag = true;
          }
        })
        .then(() => {
          if (hasStagingTag) {
            const stagingTagPath = path.join(newInstallPath, STAGING_DIR_TAG);
            return fs.readFileAsync(stagingTagPath).then((tagData) => {
              try {
                tagInstance = JSON.parse(tagData).instance;
              } catch (err) {
                log("warn", "failed to parse staging tag file", {
                  stagingTagPath,
                  error: getErrorMessageOrDefault(err),
                });
              }
            });
          }
        });
    }
    // ensure the destination directories are empty
    return queue.then(
      () =>
        new PromiseBB((resolve, reject) => {
          if (fileCount > 0 && tagInstance !== this.props.instanceId) {
            if (tagInstance !== undefined) {
              return this.props.onShowDialog(
                "question",
                "Confirm",
                {
                  text:
                    "This is an existing staging folder for a different Vortex " +
                    'instance. If you\'re using Vortex in "shared" and "regular" mode, do not use ' +
                    "the same staging folder for both!\n" +
                    "If you continue, your current mods will be merged into that staging folder and " +
                    "this Vortex instance will take over the staging folder.\n" +
                    'There is no "undo" for this! ' +
                    "Please continue only if you're absolutely certain.",
                },
                [
                  {
                    label: "Cancel",
                    action: () => reject(new UserCanceled()),
                    default: true,
                  },
                  { label: "Continue", action: () => resolve() },
                ],
              );
            } else {
              this.props.onShowDialog(
                "info",
                "Invalid Destination",
                {
                  text: "The destination folder has to be empty",
                },
                [
                  {
                    label: "Ok",
                    action: () => reject(new UserCanceled()),
                    default: true,
                  },
                ],
              );
            }
          } else {
            resolve();
          }
        }),
    );
  }

  private purgeActivation(): PromiseBB<void> {
    const { currentActivator } = this.props;
    const { supportedActivators } = this.state;

    // can't purge if there is no deployment method but there shouldn't be
    // anything _to_ purge
    if (
      supportedActivators === undefined ||
      supportedActivators.length === 0 ||
      currentActivator === undefined
    ) {
      return PromiseBB.resolve();
    }

    return new PromiseBB((resolve, reject) => {
      this.context.api.events.emit("purge-mods", true, (err) =>
        err !== null ? reject(err) : resolve(),
      );
    });
  }

  private querySwitch(newActivatorId: string): PromiseBB<void> {
    const { activators } = this.props;
    const activator = activators.find((iter) => iter.id === newActivatorId);
    if (activator === undefined || activator.onSelected === undefined) {
      return PromiseBB.resolve();
    }

    return activator.onSelected(this.context.api);
  }

  private applyActivator = () => {
    const { gameMode, onSetActivator, onShowError } = this.props;
    const { currentActivator } = this.state;

    this.nextState.changingActivator = true;
    this.querySwitch(currentActivator)
      .then(() => this.purgeActivation())
      .catch(NoDeployment, () =>
        this.context.api
          .showDialog(
            "error",
            "Purge not possible",
            {
              text:
                "Previous deployment couldn't be cleaned up because the deployment method is no " +
                "longer available (maybe you removed the corresponding extension?). " +
                "If you continue now you may get orphaned files that Vortex can no longer clean up " +
                "for you.\n",
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) =>
            result.action === "Cancel"
              ? PromiseBB.reject(new UserCanceled())
              : PromiseBB.resolve(),
          ),
      )
      .then(() => {
        onSetActivator(gameMode, currentActivator);
      })
      .finally(() => {
        this.nextState.changingActivator = false;
      })
      .then(() => {
        this.context.api.store.dispatch(setDeploymentNecessary(gameMode, true));
      })
      .catch(UserCanceled, () => null)
      .catch(TemporaryError, (err) => {
        onShowError(
          "Failed to purge previous deployment, please try again",
          err,
          false,
        );
      })
      .catch((err) => {
        if (err.code === undefined && err.errno !== undefined) {
          // unresolved windows error code
          onShowError(
            "Failed to purge previous deployment",
            {
              error: err,
              ErrorCode: err.errno,
            },
            true,
          );
        } else {
          onShowError(
            "Failed to purge previous deployment",
            err,
            !["ENOTFOUND", "ENOENT"].includes(err.code),
          );
        }
      });
  };

  private isPathSensible(input: string): boolean {
    const sanitizeSep = new RegExp("/", "g");
    const trimTrailingSep = new RegExp(`\\${path.sep}*$`, "g");
    if (process.platform === "win32") {
      // Ensure the user isn't trying to set the partition's root path
      //  as the staging folder.
      input = input.replace(sanitizeSep, path.sep).replace(trimTrailingSep, "");
      const splitInp = input.split(path.sep);
      return splitInp.length > 1
        ? true
        : splitInp[0].length === 2 && splitInp[0][1] === ":"
          ? false
          : true;
    } else {
      // Currently not imposing any restrictions on non-windows platforms.
      return true;
    }
  }

  private validateModPath(input: string): {
    state: ValidationState;
    reason?: string;
  } {
    const { downloadsPath } = this.props;
    const { appPath } = this.state;

    if (downloadsPath !== undefined) {
      const downPath = path.dirname(downloadsPath);
      const normalizedDownloadsPath = path.normalize(downPath.toLowerCase());
      const normalizedInput = path.normalize(input.toLowerCase());
      if (
        normalizedInput === normalizedDownloadsPath ||
        isChildPath(input, downPath)
      ) {
        return {
          state: "error",
          reason:
            "Staging folder can't be a subdirectory of the Vortex downloads folder.",
        };
      }
    }

    if (isReservedDirectory(input)) {
      return {
        state: "error",
        reason: "Invalid staging folder, please choose a different directory",
      };
    }

    if (appPath !== undefined && isChildPath(input, appPath)) {
      return {
        state: "error",
        reason:
          "Staging folder can't be a subdirectory of the Vortex application folder.",
      };
    }

    if (input.length > 100) {
      return {
        state: input.length > 200 ? "error" : "warning",
        reason:
          "Staging path shouldn't be too long, otherwise mod installers may fail.",
      };
    }

    if (!path.isAbsolute(input)) {
      return {
        state: "error",
        reason: "Staging folder needs to be an absolute path.",
      };
    }

    if (!isPathValid(input)) {
      return {
        state: "error",
        reason: "Path cannot contain illegal characters or reserved names",
      };
    }

    if (!this.isPathSensible(input)) {
      return {
        state: "error",
        reason: "Path cannot be the root of a partition",
      };
    }

    return {
      state: "success",
    };
  }

  private renderPathCtrl(
    label: string,
    activators: IDeploymentMethod[],
  ): JSX.Element {
    const { t, gameMode, modActivity } = this.props;
    const { installPath } = this.state;

    const pathPreview = getInstallPath(installPath, gameMode);
    const validationState = this.validateModPath(pathPreview);

    const hasModActivity = modActivity.length > 0;

    const applyDisabled =
      !this.pathsChanged() ||
      validationState.state === "error" ||
      hasModActivity;

    return (
      <FormGroup id="install-path-form" validationState={validationState.state}>
        <ControlLabel>
          {label}

          <More id="more-paths" name={t("Mod Staging Folder")}>
            {getText("modspath", t)}
          </More>
        </ControlLabel>

        <FlexLayout type="row">
          <FlexLayout.Fixed>
            <InputGroup>
              <FormControl
                className="install-path-input"
                placeholder={label}
                value={getInstallPathPattern(installPath)}
                onChange={this.changePathEvt}
                onKeyPress={
                  this.pathsChanged() && validationState.state !== "error"
                    ? this.keyPressEvt
                    : null
                }
              />

              <InputGroup.Button className="inset-btn">
                <Button tooltip={t("Browse")} onClick={this.browsePath}>
                  <Icon name="browse" />
                </Button>
              </InputGroup.Button>
            </InputGroup>
          </FlexLayout.Fixed>

          <FlexLayout.Fixed>
            <InputGroup.Button>
              <Button
                tooltip={t(
                  "This will suggest a path that puts the mods on the same drive as the game",
                )}
                onClick={this.suggestPath}
              >
                {t("Suggest")}
              </Button>

              <BSButton disabled={applyDisabled} onClick={this.onApply}>
                {hasModActivity ? <Spinner /> : t("Apply")}
              </BSButton>
            </InputGroup.Button>
          </FlexLayout.Fixed>
        </FlexLayout>

        <HelpBlock>
          <a data-url={pathPreview} onClick={this.openUrl}>
            {pathPreview}
          </a>
        </HelpBlock>

        {validationState.reason ? (
          <ControlLabel>{t(validationState.reason)}</ControlLabel>
        ) : null}
      </FormGroup>
    );
  }

  private keyPressEvt = (evt) => {
    if (evt.which === 13) {
      evt.preventDefault();
      this.onApply();
    }
  };

  private onApply = () => {
    getNormalizeFunc(
      getInstallPath(this.state.installPath, this.props.gameMode),
    ).then((normalize) => this.applyPaths(normalize));
  };

  private suggestPath = () => {
    const { modPaths, onShowError, suggestInstallPathDirectory } = this.props;
    PromiseBB.join(
      fs.statAsync(modPaths[""]),
      window.api.app
        .getPath("userData")
        .then((userDataPath) => fs.statAsync(userDataPath)),
    )
      .then((stats) => {
        let suggestion: string;
        if (stats[0].dev === stats[1].dev) {
          suggestion = path.join("{USERDATA}", "{game}", "mods");
        } else {
          const volume = winapi.GetVolumePathName(modPaths[""]);
          suggestion = path.join(volume, suggestInstallPathDirectory, "{game}");
        }
        this.changePath(suggestion);
      })
      .catch(UserCanceled, () => null)
      .catch((err) => {
        onShowError("Failed to suggest path", err);
      });
  };

  private changePathEvt = (evt) => {
    const target: HTMLInputElement = evt.target as HTMLInputElement;
    this.changePath(target.value);
  };

  private changePath = (value: string) => {
    this.nextState.installPath = value;
  };

  private openUrl = (evt) => {
    const url = evt.currentTarget.getAttribute("data-url");
    opn(url).catch(() => undefined);
  };

  private browsePath = () => {
    this.context.api.selectDir({}).then((selectedPath: string) => {
      if (selectedPath) {
        this.changePath(selectedPath);
      }
    });
  };

  private renderActivators(
    activators: IDeploymentMethod[],
    currentActivator: string,
  ): JSX.Element {
    const { t } = this.props;
    const { changingActivator } = this.state;

    let content: JSX.Element;
    let activatorIdx: number = -1;

    const changed = currentActivator !== this.props.currentActivator;

    if (activators !== undefined && activators.length > 0) {
      if (currentActivator !== undefined) {
        activatorIdx = activators.findIndex(
          (activator) => activator.id === currentActivator,
        );
      }

      content = (
        <div>
          <FormControl
            componentClass="select"
            value={currentActivator}
            onChange={this.selectActivator}
          >
            {activators.map(this.renderActivatorOption)}
          </FormControl>
        </div>
      );
    } else {
      content = (
        <ControlLabel>
          <Alert bsStyle="danger">
            <h4 style={{ marginBottom: 0 }}>
              {t("No deployment method available.")}
            </h4>

            <p style={{ marginTop: 0 }}>
              {t("See notification for more information.")}
            </p>
          </Alert>
        </ControlLabel>
      );
    }

    return (
      <FormGroup
        validationState={activators !== undefined ? undefined : "error"}
      >
        <InputGroup>
          {content}

          <InputGroup.Button>
            <BSButton
              disabled={!changed || changingActivator}
              onClick={this.applyActivator}
            >
              {changingActivator ? <Spinner /> : t("Apply")}
            </BSButton>
          </InputGroup.Button>
        </InputGroup>

        {activatorIdx !== -1 ? (
          <HelpBlock>
            {t(activators[activatorIdx].description)}

            <More
              id="more-activator-detail"
              name={activators[activatorIdx].name}
            >
              {activators[activatorIdx].detailedDescription(t)}
            </More>
          </HelpBlock>
        ) : null}
      </FormGroup>
    );
  }

  private renderActivatorOption = (
    activator: IDeploymentMethod,
  ): JSX.Element => {
    const { t } = this.props;
    return (
      <option key={activator.id} value={activator.id}>
        {t(activator.name)}
      </option>
    );
  };

  private selectActivator = (evt) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    this.nextState.currentActivator = target.value;
  };
}

const emptyArray = [];

function mapStateToProps(state: IState): IConnectedProps {
  const discovery = currentGameDiscovery(state);
  const game = currentGame(state);

  const gameMode = getSafe(discovery, ["id"], getSafe(game, ["id"], undefined));
  const downloadsPath = selectors.downloadPath(state);

  return {
    discovery,
    game,
    gameMode,
    installPath: state.settings.mods.installPath[gameMode],
    downloadsPath,
    currentActivator: getSafe(
      state,
      ["settings", "mods", "activator", gameMode],
      undefined,
    ),
    modActivity: getSafe(
      state,
      ["session", "base", "activity", "mods"],
      emptyArray,
    ),
    modPaths: modPathsForGame(state, gameMode),
    instanceId: state.app.instanceId,
    installPathMode: state.settings.mods.installPathMode,
    suggestInstallPathDirectory:
      state.settings.mods.suggestInstallPathDirectory,
    useModernLayout: state.settings.window.useModernLayout,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onSetInstallPath: (gameMode: string, newPath: string): void => {
      if (newPath !== undefined) {
        dispatch(setInstallPath(gameMode, newPath));
      }
    },
    onSetTransfer: (gameMode: string, dest: string): void => {
      dispatch(setTransferMods(gameMode, dest));
    },
    onSetActivator: (gameMode: string, id: string): void => {
      dispatch(setActivator(gameMode, id));
    },
    onSetInstallPathMode: (installPathMode: InstallPathMode) => {
      dispatch(setInstallPathMode(installPathMode));
    },
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (
      message: string,
      details: string | Error,
      allowReport?: boolean,
      isBBCode?: boolean,
    ): void => {
      showError(dispatch, message, details, { allowReport, isBBCode });
    },
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(Settings),
) as React.ComponentClass<IBaseProps>;
