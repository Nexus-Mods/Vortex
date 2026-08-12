import { mdiPlusCircleOutline, mdiPuzzleOutline } from "@mdi/js";
import { getErrorCode, getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import _ from "lodash";
import React, { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setConfirmPurge, setModAttribute, setSettingsPage } from "@/actions";
import { useMainContext } from "@/contexts";
import { registerAction } from "@/controls/ActionControl";
import { useExtensionObjects } from "@/ExtensionProvider";
import { log } from "@/logging";
import type { IActionDefinition } from "@/types/IActionDefinition";
import type { IState } from "@/types/IState";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { fileMD5 } from "@/util/checksum";
import { TemporaryError, UserCanceled } from "@/util/CustomErrors";
import * as fs from "@/util/fs";
import type { TFunction } from "@/util/i18n";
import onceCB from "@/util/onceCB";
import * as selectors from "@/util/selectors";
import { getSafe } from "@/util/storeHelper";
import { batchDispatch } from "@/util/util";
import { getIconPath } from "@/views/components/iconMap";

import NXMUrl from "../../nexus_integration/NXMUrl";
import { getAllActivators } from "../util/deploymentMethods";
import { NoDeployment } from "../util/exceptions";
import metaLookupMatch from "../util/metaLookupMatch";
import updateState from "../util/modUpdateState";
import type { IModWithState } from "../views/CheckModVersionsButton";

/**
 * A toolbar action plus where it sits in the row. The mods toolbar is assembled from
 * the page's own actions and from every extension that registered into `mod-icons`,
 * so the two have to be ordered against each other the way IconBar did it: by the
 * `position` passed to `registerAction`.
 */
interface IPositionedAction {
  position: number;
  action: IToolbarAction;
}

/**
 * Where the actions this hook builds itself sit among the registered ones. The order
 * the row reads in comes from these and from the positions passed to `registerAction`
 * elsewhere, so a change here moves the action in the overflow menu too.
 */
const POSITION = {
  installFromFile: 25,
  open: 30,
  checkVersions: 50,
  deploy: 105,
  purge: 110,
};

/**
 * Where the actions behind the "Open" button register, rather than into `mod-icons`
 * itself: the five of them take one slot on the bar between them.
 */
const OPEN_ACTION_GROUP = "mod-icons-open";

const EMPTY_MODS: { [modId: string]: IModWithState } = {};

/** Tells the user no deployment method is set, and offers to take them there. */
const useNoMethodWarning = () => {
  const { api } = useMainContext();
  const dispatch = useDispatch();

  return useCallback(() => {
    api.sendNotification({
      id: "select-deployment-method-first",
      type: "warning",
      message: "You have to select a deployment method first",
      actions: [
        {
          title: "Fix",
          action: (dismiss: () => void) => {
            api.events.emit("show-main-page", "application_settings");
            dispatch(setSettingsPage("Mods"));
            dismiss();
          },
        },
      ],
    });
  }, [api, dispatch]);
};

/** The deployment method the active game is set to use, if it resolves to one. */
const useActivator = () => {
  const gameId = useSelector(selectors.activeGameId);
  const activatorId = useSelector((state: IState) => state.settings.mods.activator?.[gameId]);

  return useMemo(
    () =>
      activatorId === undefined
        ? undefined
        : getAllActivators().find((activator) => activator.id === activatorId),
    [activatorId],
  );
};

/** Deploy Mods — was `ActivationButton`. */
const useDeployAction = (t: TFunction): IPositionedAction => {
  const { api } = useMainContext();
  const activator = useActivator();
  const needToDeploy = useSelector(selectors.needToDeploy);
  const gameId = useSelector(selectors.activeGameId);
  const profileId = useSelector((state: IState) =>
    selectors.lastActiveProfileForGame(state, gameId),
  );
  const noMethod = useNoMethodWarning();

  const deploy = useCallback(() => {
    api.events.emit(
      "deploy-mods",
      onceCB((err: Error | null) => {
        if (err === null) {
          api.sendNotification({
            id: "mods-deployed",
            type: "info",
            message: "Mods deployed",
            displayMS: 3000,
          });
          return;
        }

        if (err instanceof UserCanceled) {
          return;
        }

        if (err instanceof NoDeployment) {
          api.showErrorNotification(
            "You need to select a deployment method in settings",
            undefined,
            { allowReport: false },
          );
          return;
        }

        api.showErrorNotification("Failed to activate mods", err);
      }),
      profileId,
      undefined,
      { manual: true },
    );
  }, [api, profileId]);

  return useMemo(
    () => ({
      position: POSITION.deploy,
      action: {
        label: t("Deploy Mods"),
        iconPath: getIconPath("deploy"),
        // the id the old ActivationButton carried, which E2E selects on
        testId: "deploy-mods",
        // pending changes are the whole point of the button, so say so with colour
        brand: needToDeploy ? "primary" : "neutral",
        onClick: activator !== undefined ? deploy : noMethod,
      },
    }),
    [activator, deploy, needToDeploy, noMethod, t],
  );
};

/** Purge Mods — was `DeactivationButton`. */
const usePurgeAction = (t: TFunction): IPositionedAction => {
  const { api } = useMainContext();
  const dispatch = useDispatch();
  const activator = useActivator();
  const confirmPurge = useSelector((state: IState) => state.settings.mods.confirmPurge);
  const noMethod = useNoMethodWarning();

  const confirm = useCallback(
    () =>
      api
        .showDialog(
          "question",
          "Confirm purge",
          {
            text:
              "Purging will remove all links deployed to the game directory.\n" +
              "This is not a destructive operation, on the next deployment all links will be " +
              "restored.\n" +
              "Use this operation to force a complete re-deployment or to restore the game " +
              "directory to an unmodded-state.",
            checkboxes: [{ id: "confirm_purge", text: "Don't ask again", value: false }],
          },
          [{ label: "Cancel" }, { label: "Continue" }],
        )
        .then((result) => {
          if (result.action === "Cancel") {
            return Promise.reject(new UserCanceled());
          }

          if (result.input.confirm_purge) {
            dispatch(setConfirmPurge(false));
          }

          return Promise.resolve();
        }),
    [api, dispatch],
  );

  const purge = useCallback(() => {
    const prom: Promise<void> =
      confirmPurge !== false ? Promise.resolve(confirm()) : Promise.resolve();

    void prom
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            api.events.emit("purge-mods", false, (err: Error | null) => {
              if (err !== null) {
                reject(err);
                return;
              }

              api.sendNotification({
                id: "mods-purged",
                type: "info",
                message: "Mods purged",
                displayMS: 3000,
              });
              resolve();
            });
          }),
      )
      .catch((err) => {
        if (err instanceof UserCanceled) {
          return;
        }

        if (err instanceof TemporaryError) {
          api.showErrorNotification("Failed to purge mods, please try again", err.message, {
            allowReport: false,
          });
          return;
        }

        if (err instanceof NoDeployment) {
          api.showErrorNotification(
            "You need to select a deployment method in settings",
            undefined,
            { allowReport: false },
          );
          return;
        }

        const errCode = getErrorCode(err);
        if (errCode == null && (err as { errno?: number }).errno !== undefined) {
          // unresolved windows error code
          api.showErrorNotification(
            "Failed to purge mods",
            { error: err, ErrorCode: (err as { errno?: number }).errno },
            { allowReport: true },
          );
          return;
        }

        const isFSErr = ["ENOTFOUND", "ENOENT", "EMFILE"].includes(errCode);
        if (isFSErr) {
          const converted = unknownToError(err);
          converted.message =
            "A filesystem error prevented purging some files. " +
            "please try purging again.\n" +
            converted.message;
          api.showErrorNotification("Failed to purge mods", converted, { allowReport: false });
          return;
        }

        api.showErrorNotification("Failed to purge mods", err, { allowReport: true });
      });
  }, [api, confirm, confirmPurge]);

  return useMemo(
    () => ({
      position: POSITION.purge,
      action: {
        label: t("Purge Mods"),
        iconPath: getIconPath("purge"),
        testId: "purge-mods",
        onClick: activator !== undefined ? purge : noMethod,
      },
    }),
    [activator, noMethod, purge, t],
  );
};

/** Install From File — was `InstallArchiveButton`. */
const useInstallFromFileAction = (t: TFunction): IPositionedAction => {
  const { api } = useMainContext();
  const copyOnIFF = useSelector((state: IState) => state.settings.downloads.copyOnIFF);

  const install = useCallback(() => {
    void api.selectFile({ title: t("Select archive") }).then((filePath) => {
      if (filePath === undefined) {
        return;
      }

      if (copyOnIFF) {
        api.events.emit("import-downloads", [filePath], (dlIds: string[]) => {
          dlIds.forEach((dlId) => api.events.emit("start-install-download", dlId));
        });
        return;
      }

      api.events.emit("start-install", filePath, (error: Error, id: string) => {
        if (error) {
          return;
        }

        const gameId = selectors.activeGameId(api.getState());

        return Promise.all([fileMD5(filePath), fs.statAsync(filePath)])
          .then(([md5, stat]) =>
            api.lookupModMeta({ fileMD5: md5, filePath, gameId, fileSize: stat.size }, false),
          )
          .then((modInfo) => {
            const match = metaLookupMatch(modInfo, filePath, gameId);
            if (match === undefined) {
              return;
            }

            const info = match.value;
            const actions = [];
            const setInfo = (key: string, value: any) => {
              if (value !== undefined) {
                actions.push(setModAttribute(gameId, id, key, value));
              }
            };

            try {
              const nxmUrl = new NXMUrl(info.sourceURI);
              setInfo("source", "nexus");
              setInfo("description", info.details.description);
              setInfo("category", info.details.category);
              setInfo("downloadGame", nxmUrl.gameId);
              setInfo("fileId", nxmUrl.fileId);
              setInfo("modId", nxmUrl.modId);
              batchDispatch(api.store, actions);
            } catch {
              setInfo("source", "unknown");
            }
          })
          .catch((err) => {
            log("warn", "failed to look up mod meta info", {
              message: getErrorMessageOrDefault(err),
            });
          });
      });
    });
  }, [api, copyOnIFF, t]);

  return useMemo(
    () => ({
      position: POSITION.installFromFile,
      action: {
        label: t("Install From File"),
        iconPath: mdiPlusCircleOutline,
        testId: "install-from-archive",
        onClick: install,
      },
    }),
    [install, t],
  );
};

/** Check for Updates — was `CheckModVersionsButton`. */
const useCheckVersionsAction = (t: TFunction): IPositionedAction => {
  const { api } = useMainContext();
  const gameMode = useSelector(selectors.activeGameId);
  // both live in slices extensions register at runtime, so they aren't on IState
  const updateRunning = useSelector((state: IState) =>
    getSafe<boolean>(state, ["session", "mods", "updatingMods", gameMode], false),
  );
  const isPremium = useSelector((state: IState) =>
    getSafe<boolean>(state, ["persistent", "nexus", "userInfo", "isPremium"], false),
  );

  /**
   * The mods as they are *now*, not as they were when this action was built. The
   * check writes new version attributes to the store, so whatever runs after it
   * has to re-read them or it decides "all up to date" from pre-check data.
   */
  const readModsWithState = useCallback(() => {
    const state = api.getState();
    const gameId = selectors.activeGameId(state);
    const profile = selectors.activeProfile(state);
    const mods = state.persistent.mods[gameId];

    if (mods === undefined || profile?.modState === undefined) {
      return EMPTY_MODS;
    }

    return Object.keys(mods).reduce<{ [modId: string]: IModWithState }>((prev, modId) => {
      prev[modId] = {
        ...mods[modId],
        ...(profile.modState[modId] || { enabled: false, enabledTime: 0 }),
      };
      return prev;
    }, {});
  }, [api]);

  const updateAll = useCallback(
    (modIds: string[]) => {
      const mods = readModsWithState();
      const updateAble = modIds.filter((modId) => {
        const mod = mods[modId];
        if (mod?.attributes == null) {
          return false;
        }
        return updateState(mod.attributes) === "update" && mod.type !== "collection";
      });

      if (updateAble.length < modIds.length) {
        api.sendNotification({
          id: "check-mods-version-partial",
          type: "info",
          message: "Some mods could not be updated automatically.",
        });
      }

      if (updateAble.length > 0) {
        api.events.emit("mods-update", gameMode, updateAble);
      }
    },
    [api, gameMode, readModsWithState],
  );

  const check = useCallback(() => {
    const modsAtStart = readModsWithState();
    const modIds = Object.keys(modsAtStart);

    void api
      .emitAndAwait("check-mods-version", gameMode, _.pick(modsAtStart, modIds), true)
      .catch((err) => {
        api.showErrorNotification("Error checking for mod updates", err);
      })
      .then(() => {
        const modsAfterCheck = readModsWithState();
        const outdated = modIds.filter((modId) => {
          const mod = modsAfterCheck[modId];
          if (mod?.attributes == null) {
            return false;
          }
          return (
            updateState(mod.attributes) === "update" &&
            mod.type !== "collection" &&
            mod.enabled === true
          );
        });

        api.sendNotification({
          id: "check-mods-version-complete",
          type: "success",
          message:
            outdated.length === 0
              ? "All mods up to date"
              : `${outdated.length} mod update${outdated.length === 1 ? "" : "s"} available`,
          actions:
            isPremium && outdated.length > 0
              ? [
                  {
                    title: "Update All",
                    action: (dismiss: () => void) => {
                      dismiss();
                      updateAll(outdated);
                    },
                  },
                ]
              : undefined,
          displayMS: outdated.length === 0 ? 5000 : undefined,
        });
      });
  }, [api, gameMode, isPremium, readModsWithState, updateAll]);

  return useMemo(
    () => ({
      position: POSITION.checkVersions,
      action: updateRunning
        ? {
            label: t("Checking for mod updates"),
            iconPath: getIconPath("refresh"),
            disabled: true,
            isLoading: true,
          }
        : {
            label: t("Check for Updates"),
            iconPath: getIconPath("refresh"),
            testId: "check-mod-updates-button",
            onClick: check,
          },
    }),
    [check, t, updateRunning],
  );
};

/**
 * Adapts the actions extensions registered into a group for the toolbar, the way
 * IconBar rendered them: hidden when `condition` returns false, disabled when it
 * returns a string, ordered by `position`.
 */
const useRegisteredActions = (group: string): IPositionedAction[] => {
  const objects = useExtensionObjects<IActionDefinition>(registerAction, undefined, group, true);

  return objects.reduce<IPositionedAction[]>((prev, definition) => {
    if (definition.component !== undefined) {
      // the toolbar renders actions, not arbitrary components — anything still
      // registering one has to be converted before it can appear here
      log("warn", "toolbar action registered as a component is not shown", {
        position: definition.position,
      });
      return prev;
    }

    // a toolbar action acts on the page, not on a row, so it gets no instance ids —
    // the same `undefined` IconBar passes when it has no `instanceId` of its own
    const instanceIds = undefined as unknown as string[];

    let condition: boolean | string;
    try {
      condition = definition.condition?.(instanceIds) ?? true;
    } catch (err) {
      condition = getErrorMessageOrDefault(err);
    }

    if (condition === false) {
      return prev;
    }

    prev.push({
      position: definition.position ?? 100,
      action: {
        label: definition.title,
        // an icon name we have no mdi path for is an extension's own, so say as much
        // rather than showing the generic shape the map falls back to
        iconPath: getIconPath(definition.icon, mdiPuzzleOutline),
        // a string condition explains why the action can't be used; the toolbar
        // has nowhere to put that yet, so it only greys the action out
        disabled: typeof condition === "string",
        onClick: () => definition.action?.(instanceIds),
      },
    });

    return prev;
  }, []);
};

/**
 * One "Open" button standing in for every place the page can open, which is a menu
 * rather than a click. Absent when nothing registered into the group — no game
 * offers none of them today, but an action with an empty menu would be a dead end.
 */
const useOpenAction = (t: TFunction): IPositionedAction | undefined => {
  const openActions = useRegisteredActions(OPEN_ACTION_GROUP);

  return useMemo(() => {
    if (openActions.length === 0) {
      return undefined;
    }

    const label = t("Open");
    const actions = [...openActions]
      .sort((lhs, rhs) => lhs.position - rhs.position)
      .map((entry) => entry.action);

    return {
      position: POSITION.open,
      action: {
        label,
        iconPath: getIconPath("open-ext"),
        panelRole: "menu",
        // picking somewhere to open ends the interaction, so the menu goes away
        // with the panel rather than leaving the button showing a list
        panel: ({ dismiss }) => (
          <PopoverMenu actions={[actions]} label={label} onSelect={dismiss} />
        ),
      },
    };
  }, [openActions, t]);
};

/**
 * Everything the mods page puts in its toolbar: its own actions, the "Open" menu, and
 * whatever extensions registered into `mod-icons`, in the order IconBar showed them.
 * Which of them sit on the bar is the user's to change — see `useToolbarPinning` —
 * and anything that doesn't fit is collapsed into the overflow menu by
 * {@link ToolbarGroup}, so this is a flat list.
 */
export const useModToolbarActions = (t: TFunction): IToolbarAction[] => {
  const installFromFile = useInstallFromFileAction(t);
  const checkVersions = useCheckVersionsAction(t);
  const deploy = useDeployAction(t);
  const purge = usePurgeAction(t);
  const open = useOpenAction(t);
  const registered = useRegisteredActions("mod-icons");

  return useMemo(
    () =>
      [installFromFile, checkVersions, deploy, purge, ...(open ? [open] : []), ...registered]
        .sort((lhs, rhs) => lhs.position - rhs.position)
        .map((entry) => entry.action),
    [checkVersions, deploy, installFromFile, open, purge, registered],
  );
};
