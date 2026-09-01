import { mdiPlusCircleOutline, mdiPuzzleOutline } from "@mdi/js";
import { getErrorCode, getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import _ from "lodash";
import React, { useCallback, useMemo } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

import { setConfirmPurge, setModAttribute, setSettingsPage } from "@/actions";
import { useMainContext } from "@/contexts";
import { registerAction } from "@/controls/ActionControl";
import { useExtensionObjects } from "@/ExtensionProvider";
import { log } from "@/logging";
import type { IActionDefinition } from "@/types/IActionDefinition";
import type { IState } from "@/types/IState";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import type { IToolbarAnalytics } from "@/ui/components/toolbar/Toolbar.context";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { trackedActions } from "@/ui/components/toolbar/ToolbarGroup";
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
  icon?: string;
}

/**
 * Where the actions this hook builds itself sit among the registered ones, which is
 * fixed: pinning an action puts it back where it belongs rather than at the end.
 *
 * The order the bar reads in — Install From File, Open, History, Check for Updates,
 * Categories, Manage Rules — comes from these and from the positions passed to
 * `registerAction` elsewhere, so a change here moves the action in the overflow menu
 * too. Deploy and Purge keep the positions they had as components, being unpinned by
 * default and so seen in that menu.
 */
const POSITION = {
  installFromFile: 25,
  open: 30,
  checkVersions: 50,
  deploy: 105,
  purge: 110,
  import: 120,
};

/**
 * A set of related actions the row shows as one button, so that they take a single slot
 * on the bar between them.
 *
 * Actions land in one either by registering into `group`, which is how to ask for it,
 * or by registering into `mod-icons` under `icon`. The second is what IconBar used to
 * do to every icon shared by more than one action, labelling the result with whatever
 * leading words their titles had in common — which is how the "Open ..." and
 * "Import From ..." actions came to sit behind one button each without anyone asking.
 * Extensions we don't ship still rely on that, so these two buckets keep folding.
 */
interface IActionMenu {
  id: string;
  icon: string;
  group: string;
  label: string;
  position: number;
  pinned: boolean;
}

const OPEN_MENU: IActionMenu = {
  id: "open",
  icon: "open-ext",
  group: "mod-icons-open",
  label: "Open",
  position: POSITION.open,
  pinned: true,
};

const IMPORT_MENU: IActionMenu = {
  id: "import",
  icon: "import",
  group: "mod-icons-import",
  label: "Import",
  position: POSITION.import,
  pinned: false,
};

const ACTION_MENUS = [OPEN_MENU, IMPORT_MENU];

/** Stands in for a menu nothing landed in, so the memos below keep a stable input. */
const NO_ACTIONS: IPositionedAction[] = [];

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
        id: "deploy",
        label: t("Deploy Mods"),
        iconPath: getIconPath("deploy"),
        testId: "deploy-mods",
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
        id: "purge",
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
        id: "install-from-file",
        label: t("Install From File"),
        iconPath: mdiPlusCircleOutline,
        pinned: true,
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
            id: "check-versions",
            label: t("Checking for mod updates"),
            iconPath: getIconPath("refresh"),
            pinned: true,
            disabled: true,
            isLoading: true,
          }
        : {
            id: "check-versions",
            label: t("Check for Updates"),
            iconPath: getIconPath("refresh"),
            pinned: true,
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
 * returns a string, ordered by `position`, plus whatever each has to say for itself
 * in brackets after its title — see {@link IActionOptions.notice}.
 */
const useRegisteredActions = (group: string): IPositionedAction[] => {
  const objects = useExtensionObjects<IActionDefinition>(registerAction, undefined, group, true);

  // Read through the store, so a notice can follow state rather than be fixed at registration.
  const notices = useSelector(
    () => objects.map((definition) => definition.options?.notice?.()),
    shallowEqual,
  );

  return objects.reduce<IPositionedAction[]>((prev, definition, index) => {
    // Something registered for the classic toolbar to render, which the classic
    // toolbar is still there to render — see ModList. Nothing to say about it.
    if (definition.options?.isClassicOnly) {
      return prev;
    }

    // A component can't become an action: the row needs a label and an icon it can
    // measure, promote, collapse into the overflow menu and let the user pin. So a
    // component registration only ever draws on the classic bar. Said at debug because
    // that is now the arrangement rather than a surprise, and this runs every render.
    if (definition.component !== undefined) {
      log("debug", "toolbar action registered as a component is shown only in the classic UI", {
        position: definition.position,
      });
      return prev;
    }

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

    const notice = notices[index];

    prev.push({
      position: definition.position ?? 100,
      icon: definition.icon,
      action: {
        // The registered title, which is the source string rather than the
        // translation, so a decision to pin survives a language change. It is also
        // what IconBar built its DOM ids from.
        id: definition.title,
        label: !notice ? definition.title : `${definition.title} (${notice})`,
        iconPath: getIconPath(definition.icon, mdiPuzzleOutline),
        pinned: definition.options?.pinned ?? false,
        disabled: typeof condition === "string",
        extension: definition.options?.namespace,
        onClick: () => definition.action?.(instanceIds),
      },
    });

    return prev;
  }, []);
};

/**
 * The single button an {@link IActionMenu} shows as, which opens a menu rather than
 * doing anything itself.
 *
 * A menu nothing landed in is absent rather than a button opening an empty list, and
 * one holding a single action is that action rather than a menu of one — which is what
 * IconBar did with a bucket it found only one action in, and what keeps a game that
 * supports only one importer from showing an "Import" button to reach it.
 *
 * `adopted` are the actions from `mod-icons` that belong here by their icon rather than
 * by the group they registered into.
 */
const useActionMenu = (
  t: TFunction,
  menu: IActionMenu,
  adopted: IPositionedAction[],
  onActionClick: IToolbarAnalytics["onActionClick"] | undefined,
): IPositionedAction | undefined => {
  const registered = useRegisteredActions(menu.group);

  return useMemo(() => {
    const entries = [...registered, ...adopted].sort((lhs, rhs) => lhs.position - rhs.position);

    if (entries.length === 0) {
      return undefined;
    }

    if (entries.length === 1) {
      return { position: menu.position, action: entries[0].action };
    }

    const label = t(menu.label);

    const actions = trackedActions(
      entries.map((entry) => entry.action),
      "menu",
      onActionClick,
    );

    return {
      position: menu.position,
      action: {
        id: menu.id,
        label: `${label}...`,
        iconPath: getIconPath(menu.icon),
        pinned: menu.pinned,
        panelRole: "menu",
        panel: ({ dismiss }) => (
          <PopoverMenu actions={[actions]} label={label} onSelect={dismiss} />
        ),
      },
    };
  }, [adopted, menu, onActionClick, registered, t]);
};

/**
 * Everything the mods page puts in its toolbar: its own actions, the menus of
 * {@link ACTION_MENUS}, and whatever extensions registered into `mod-icons`, in the
 * order IconBar showed them. Which of them sit on the bar is the user's to change —
 * see `useToolbarPinning` — and anything that doesn't fit is collapsed into the
 * overflow menu by {@link ToolbarGroup}, so this is a flat list.
 */
export const useModToolbarActions = (
  t: TFunction,
  onActionClick?: IToolbarAnalytics["onActionClick"],
): IToolbarAction[] => {
  const installFromFile = useInstallFromFileAction(t);
  const checkVersions = useCheckVersionsAction(t);
  const deploy = useDeployAction(t);
  const purge = usePurgeAction(t);
  const registered = useRegisteredActions("mod-icons");

  const byIcon = useMemo(() => _.groupBy(registered, (entry) => entry.icon), [registered]);
  const ownRow = useMemo(
    () => registered.filter((entry) => !ACTION_MENUS.some((menu) => menu.icon === entry.icon)),
    [registered],
  );

  const open = useActionMenu(t, OPEN_MENU, byIcon[OPEN_MENU.icon] ?? NO_ACTIONS, onActionClick);
  const importFrom = useActionMenu(
    t,
    IMPORT_MENU,
    byIcon[IMPORT_MENU.icon] ?? NO_ACTIONS,
    onActionClick,
  );

  return useMemo(
    () =>
      [installFromFile, checkVersions, deploy, purge, open, importFrom, ...ownRow]
        .filter((entry): entry is IPositionedAction => entry !== undefined)
        .sort((lhs, rhs) => lhs.position - rhs.position)
        .map((entry) => entry.action),
    [checkVersions, deploy, importFrom, installFromFile, open, ownRow, purge],
  );
};
