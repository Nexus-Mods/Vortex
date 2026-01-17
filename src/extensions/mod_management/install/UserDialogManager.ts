/**
 * UserDialogManager - Handles user interaction dialogs during mod installation.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This class manages:
 * - Replace/variant selection dialogs
 * - Password entry dialogs
 * - Archive error continuation dialogs
 * - Dependency ignore confirmation dialogs
 * - Version choice dialogs
 */

import Bluebird from "bluebird";
import _ from "lodash";
import * as path from "path";

import {
  type IConditionResult,
  type IDialogContent,
  showDialog,
} from "../../../actions/notifications";
import type { ICheckbox, IDialogResult } from "../../../types/IDialog";
import type {
  IExtensionApi,
  ThunkStore,
} from "../../../types/IExtensionContext";
import type { IProfile, IState } from "../../../types/IState";
import { getBatchContext } from "../../../util/BatchContext";
import { UserCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import type { TFunction } from "../../../util/i18n";
import { log } from "../../../util/log";
import {
  activeProfile,
  gameProfiles,
  profileById,
} from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import { batchDispatch, truthy } from "../../../util/util";

import { removeDownload } from "../../../actions";
import { addModRule, removeModRule } from "../actions/mods";
import { setModEnabled } from "../../profile_management/actions/profiles";
import { getCollectionActiveSession } from "../../collections_integration/selectors";

import modName from "../util/modName";
import testModReference from "../util/testModReference";
import type {
  IFileListItem,
  IMod,
  IModReference,
  IModRule,
} from "../types/IMod";
import type { IReplaceChoice } from "./types/IInstallationEntry";
import { MAX_VARIANT_NAME, MIN_VARIANT_NAME } from "../constants";

/**
 * Options passed to the replace/variant dialog.
 */
export interface IInstallDialogOptions {
  /** Whether this is an unattended/silent install */
  unattended?: boolean;
  /** List of files to match against existing mod */
  fileList?: IFileListItem[];
  /** Installer choices that were made */
  choices?: any;
  /** Patches to apply */
  patches?: any;
  /** Variant number for auto-naming */
  variantNumber?: number;
}

/**
 * Action labels for version choice dialog.
 */
export const INSTALL_ACTION = "Update current profile";
export const REPLACE_ACTION = "Update all profiles";

/**
 * Validates variant name length.
 * Returns validation errors if name is too short or too long.
 */
export function validateVariantName(
  t: TFunction,
  content: IDialogContent,
): IConditionResult[] {
  const variantName =
    content.input.find((inp) => inp.id === "variant")?.value ?? "";

  if (
    variantName.length < MIN_VARIANT_NAME ||
    variantName.length > MAX_VARIANT_NAME
  ) {
    return [
      {
        id: "variant",
        actions: ["Continue"],
        errorText: t("Name must be between {{min}}-{{max}} characters long", {
          replace: {
            min: MIN_VARIANT_NAME,
            max: MAX_VARIANT_NAME,
          },
        }),
      },
    ];
  } else {
    return [];
  }
}

/**
 * Manages user interaction dialogs during mod installation.
 *
 * Provides methods for showing various installation-related dialogs
 * and processing user responses.
 */
export class UserDialogManager {
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  /**
   * Show dialog when archive extraction encounters errors.
   * Allows user to cancel, delete the archive, or continue anyway.
   *
   * @param errors - List of extraction error messages
   * @param archivePath - Path to the archive file
   * @returns Promise that resolves if user chooses to continue, rejects on cancel
   */
  public queryContinue(errors: string[], archivePath: string): Bluebird<void> {
    const api = this.mApi;
    const terminal = errors.find(
      (err) => err.indexOf("Can not open the file as archive") !== -1,
    );

    return new Bluebird<void>((resolve, reject) => {
      const actions = [
        { label: "Cancel", action: () => reject(new UserCanceled()) },
        {
          label: "Delete",
          action: () => {
            fs.removeAsync(archivePath)
              .catch((err) =>
                api.showErrorNotification("Failed to remove archive", err, {
                  allowReport: false,
                }),
              )
              .finally(() => {
                const { files } = api.getState().persistent.downloads;
                const dlId = Object.keys(files).find(
                  (iter) =>
                    files[iter].localPath === path.basename(archivePath),
                );
                if (dlId !== undefined) {
                  api.store.dispatch(removeDownload(dlId));
                }
                reject(new UserCanceled());
              });
          },
        },
      ];

      if (!terminal) {
        actions.push({ label: "Continue", action: () => resolve() });
      }

      const title = api.translate('Archive damaged "{{archiveName}}"', {
        replace: { archiveName: path.basename(archivePath) },
      });
      api.store.dispatch(
        showDialog(
          "error",
          title,
          {
            bbcode: api.translate(
              "Encountered errors extracting this archive. Please verify this " +
                "file was downloaded correctly.\n[list]{{ errors }}[/list]",
              {
                replace: { errors: errors.map((err) => "[*] " + err) },
              },
            ),
            options: { translated: true },
          },
          actions,
        ),
      );
    });
  }

  /**
   * Show password entry dialog for encrypted archives.
   *
   * @param store - Redux store for dispatching dialog
   * @returns Promise that resolves with the entered password
   */
  public queryPassword(store: ThunkStore<any>): Bluebird<string> {
    return new Bluebird<string>((resolve, reject) => {
      store
        .dispatch(
          showDialog(
            "info",
            "Password Protected",
            {
              input: [
                {
                  id: "password",
                  type: "password",
                  value: "",
                  label: "A password is required to extract this archive",
                },
              ],
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          ),
        )
        .then((result: IDialogResult) => {
          if (result.action === "Continue") {
            resolve(result.input["password"]);
          } else {
            reject(new UserCanceled());
          }
        });
    });
  }

  /**
   * Show dialog confirming that dependent mod rules should be ignored.
   * Used when updating a mod that other mods depend on.
   *
   * @param store - Redux store for dispatching
   * @param gameId - Current game ID
   * @param dependents - List of dependent mods and their rules
   * @returns Promise that resolves if user confirms, rejects on cancel
   */
  public queryIgnoreDependent(
    store: ThunkStore<any>,
    gameId: string,
    dependents: Array<{ owner: string; rule: IModRule }>,
  ): Bluebird<void> {
    const batchKey = "remember-ignore-dependent-action";
    let context = getBatchContext("install-mod", "", false);
    const handleAction = (action: string, remember: boolean) => {
      if (remember) {
        context = getBatchContext("install-mod", "", true);
        context?.set?.(batchKey, action);
      }
      if (action === "Cancel") {
        return Bluebird.reject(new UserCanceled());
      } else {
        const ruleActions = dependents.reduce((prev, dep) => {
          prev.push(removeModRule(gameId, dep.owner, dep.rule));
          prev.push(
            addModRule(gameId, dep.owner, {
              ...dep.rule,
              ignored: true,
            }),
          );
          return prev;
        }, []);
        batchDispatch(store, ruleActions);
        return Bluebird.resolve();
      }
    };
    return new Bluebird<void>((resolve, reject) => {
      const rememberAction = context?.get?.(batchKey, false);
      if (rememberAction) {
        // if we already have a remembered action, just resolve
        return handleAction(rememberAction, true)
          .then(() => resolve())
          .catch((err) => reject(err));
      }
      store
        .dispatch(
          showDialog(
            "question",
            "Updating may break dependencies",
            {
              text:
                "You're updating a mod that others depend upon and the update doesn't seem to " +
                "be compatible (according to the dependency information). " +
                "If you continue we have to disable these dependencies, otherwise you'll " +
                "continually get warnings about it.",
              options: { wrap: true },
              checkboxes: [
                {
                  id: "remember",
                  value: false,
                  text: "Remember my choice",
                },
              ],
            },
            [{ label: "Cancel" }, { label: "Ignore" }],
          ),
        )
        .then((result: IDialogResult) =>
          handleAction(result.action, result.input.remember)
            .then(() => resolve())
            .catch((err) => reject(err)),
        );
    });
  }

  /**
   * Get the number of profiles for the current game.
   * Helper for version choice logic.
   */
  private queryProfileCount(store: ThunkStore<any>): number {
    const state = store.getState();
    const profiles = gameProfiles(state);
    return profiles.length;
  }

  /**
   * Show dialog for choosing between replacing existing mod or installing alongside.
   * Used when updating a mod with multiple profiles.
   *
   * @param oldMod - The existing mod being updated
   * @param store - Redux store for dispatching
   * @returns Promise resolving to user's choice action
   */
  public userVersionChoice(
    oldMod: IMod,
    store: ThunkStore<any>,
  ): Bluebird<string> {
    const totalProfiles = this.queryProfileCount(store);
    const batchAction = "remember-user-version-choice-action";
    const handleAction = (action: string, remember: boolean) => {
      if (remember) {
        const context = getBatchContext("install-mod", "", true);
        context?.set?.(batchAction, action);
      }
      if (action === "Cancel") {
        return Bluebird.reject(new UserCanceled());
      } else if (action === REPLACE_ACTION) {
        return Bluebird.resolve(REPLACE_ACTION);
      } else if (action === INSTALL_ACTION) {
        return Bluebird.resolve(INSTALL_ACTION);
      }
    };

    const context = getBatchContext("install-mod", "", false);
    const rememberAction = context?.get?.(batchAction);
    return rememberAction
      ? Bluebird.resolve(rememberAction)
      : totalProfiles === 1
        ? Bluebird.resolve(REPLACE_ACTION)
        : new Bluebird<string>((resolve, reject) => {
            store
              .dispatch(
                showDialog(
                  "question",
                  modName(oldMod),
                  {
                    text:
                      "An older version of this mod is already installed. " +
                      "You can replace the existing one - which will update all profiles - " +
                      "or install this one alongside it. In the latter case both versions " +
                      "will be available and only the active profile will be updated. ",
                    options: { wrap: true },
                    checkboxes: [
                      {
                        id: "remember",
                        value: false,
                        text: "Remember my choice",
                      },
                    ],
                  },
                  [
                    { label: "Cancel" },
                    { label: REPLACE_ACTION },
                    { label: INSTALL_ACTION },
                  ],
                ),
              )
              .then((result: IDialogResult) =>
                handleAction(result.action, result.input.remember),
              )
              .then(resolve)
              .catch(reject);
          });
  }

  /**
   * Show dialog for replacing existing mod or creating a variant.
   * The most complex dialog - handles batch operations, remembered choices,
   * variant naming, and automatic variant creation for dependencies.
   *
   * @param modIds - IDs of existing mods that match the archive
   * @param gameId - Current game ID
   * @param installOptions - Installation options affecting dialog behavior
   * @returns Promise resolving to the user's replace/variant choice
   */
  public queryUserReplace(
    modIds: string[],
    gameId: string,
    installOptions: IInstallDialogOptions,
  ): Bluebird<IReplaceChoice> {
    const api = this.mApi;

    return new Bluebird<IReplaceChoice>((resolve, reject) => {
      const state: IState = api.store.getState();
      const mods: IMod[] = Object.values(state.persistent.mods[gameId]).filter(
        (mod) => modIds.includes(mod.id) && mod.state === "installed",
      );
      const batchContext = getBatchContext(
        ["install-dependencies", "install-recommendations"],
        "",
      );
      const profileId =
        batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
      const currentProfile = profileById(api.store.getState(), profileId);
      if (mods.length === 0) {
        // Technically for this to happen the timing must be *perfect*,
        //  the replace query dialog will only show if we manage to confirm that
        //  the modId is indeed stored persistently - but if somehow the user
        //  was able to finish removing the mod right as the replace dialog
        //  appears the mod could be potentially missing from the state.
        // In this case we resolve using the existing modId.
        // https://github.com/Nexus-Mods/Vortex/issues/7972
        return resolve({
          id: modIds[0],
          variant: "",
          enable: getSafe(
            currentProfile,
            ["modState", modIds[0], "enabled"],
            false,
          ),
          attributes: {},
          rules: [],
          replaceChoice: "replace",
        });
      }

      const context = getBatchContext("install-mod", mods[0].archiveId);

      const queryVariantNameDialog = (remember: boolean) => {
        const checkVariantRemember: ICheckbox[] = [];
        if (truthy(context)) {
          const itemsCompleted = context.get("items-completed", 0);
          const itemsLeft = context.itemCount - itemsCompleted;
          if (itemsLeft > 1 && remember) {
            checkVariantRemember.push({
              id: "remember",
              value: false,
              text: api.translate(
                "Use this name for all remaining variants ({{count}} more)",
                {
                  count: itemsLeft - 1,
                },
              ),
            });
          }
        }

        return api
          .showDialog(
            "question",
            "Install options - Name mod variant",
            {
              text: 'Enter a variant name for "{{modName}}" to differentiate it from the original',
              input: [
                {
                  id: "variant",
                  value:
                    installOptions.variantNumber > 2
                      ? installOptions.variantNumber.toString()
                      : "2",
                  label: "Variant",
                },
              ],
              checkboxes: checkVariantRemember,
              md:
                "**Remember:** You can switch between variants by clicking in the version " +
                "column in your mod list and selecting from the dropdown.",
              parameters: {
                modName: modName(mods[0], { version: false }),
              },
              condition: (content: IDialogContent) =>
                validateVariantName(api.translate, content),
              options: {
                order: ["text", "input", "md", "checkboxes"],
              },
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) => {
            if (result.action === "Cancel") {
              context?.set?.("canceled", true);
              return Bluebird.reject(new UserCanceled());
            } else {
              if (result.input.remember) {
                context.set("variant-name", result.input.variant);
              }
              return Bluebird.resolve(result.input.variant);
            }
          });
      };

      const mod = mods[0];
      const modReference: IModReference = {
        id: mod.id,
        fileList: installOptions?.fileList,
        archiveId: mod.archiveId,
        gameId,
        installerChoices: installOptions?.choices,
        patches: installOptions?.patches,
      };
      const isDependency =
        installOptions?.unattended === true &&
        testModReference(mods[0], modReference) === false;
      const addendum = isDependency
        ? " and is trying to be reinstalled as a dependency by another mod or collection."
        : ".";

      const checkRoVRemember: ICheckbox[] = [];

      const queryDialog = () =>
        api
          .showDialog(
            "question",
            "Install options",
            {
              bbcode: api.translate(
                `"{{modName}}" is already installed on your system${addendum}` +
                  "[br][/br][br][/br]Would you like to:",
                { replace: { modName: modName(mods[0], { version: false }) } },
              ),
              choices: [
                {
                  id: "replace",
                  value: true,
                  text:
                    "Replace the existing mod" +
                    (isDependency ? " (recommended)" : ""),
                  subText:
                    "This will replace the existing mod on all your profiles.",
                },
                {
                  id: "variant",
                  value: false,
                  text: "Install as variant of the existing mod",
                  subText:
                    "This will allow you to install variants of the same mod and easily " +
                    "switch between them from the version drop-down in the mods table. " +
                    "This can be useful if you want to install the same mod but with " +
                    "different options in different profiles.",
                },
              ],
              checkboxes: checkRoVRemember,
              options: {
                wrap: true,
                order: ["choices", "checkboxes"],
              },
              parameters: {
                modName: modName(mods[0], { version: false }),
              },
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) => {
            if (result.action === "Cancel") {
              context?.set?.("canceled", true);
              return Bluebird.reject(new UserCanceled());
            } else if (result.input.variant) {
              return queryVariantNameDialog(result.input.remember).then(
                (variant) => ({
                  action: "variant",
                  variant,
                  remember: result.input.remember,
                }),
              );
            } else if (result.input.replace) {
              return {
                action: "replace",
                remember: result.input.remember,
              };
            }
          });

      const queryVariantReplacement = () =>
        api.showDialog(
          "question",
          "Select Variant to Replace",
          {
            text: '"{{modName}}" has several variants installed - please choose which one to replace:',
            choices: modIds.map((id, idx) => {
              const modAttributes = mods[idx].attributes;
              const variant = getSafe(modAttributes, ["variant"], "");
              return {
                id,
                value: idx === 0,
                text: `modId: ${id}`,
                subText: api.translate(
                  "Version: {{version}}; InstallTime: {{installTime}}; Variant: {{variant}}",
                  {
                    replace: {
                      version: getSafe(modAttributes, ["version"], "Unknown"),
                      installTime: new Date(
                        getSafe(modAttributes, ["installTime"], 0),
                      ),
                      variant: truthy(variant) ? variant : "Not set",
                    },
                  },
                ),
              };
            }),
            parameters: {
              modName: modName(mods[0], { version: false }),
            },
          },
          [{ label: "Cancel" }, { label: "Continue" }],
        );

      let choices: Bluebird<{
        action: string;
        variant?: string;
        remember: boolean;
      }>;

      if (context !== undefined) {
        if (context.get("canceled", false)) {
          return reject(new UserCanceled());
        }

        const action = context.get("replace-or-variant");
        const itemsCompleted = context.get("items-completed", 0);
        const itemsLeft = context.itemCount - itemsCompleted;
        if (itemsLeft > 1) {
          if (action === undefined) {
            checkRoVRemember.push({
              id: "remember",
              value: false,
              text: api.translate(
                "Do this for all remaining reinstalls ({{count}} more)",
                {
                  count: itemsLeft - 1,
                },
              ),
            });
          }
        }

        if (action !== undefined) {
          let variant: string = context.get("variant-name");
          if (action === "variant" && variant === undefined) {
            choices = queryVariantNameDialog(
              context.get("replace-or-variant") !== undefined,
            ).then((variantName) => ({
              action,
              variant: variantName,
              remember: true,
            }));
          } else {
            if (variant !== undefined && installOptions.variantNumber > 1) {
              variant += `.${installOptions.variantNumber}`;
            }
            choices = Bluebird.resolve({
              action,
              variant,
              remember: true,
            });
          }
        }
      }

      // When installing as a dependency, check if the existing mod is enabled in a different profile.
      // If so, create a variant so each profile can have its own version of the mod.
      if (!choices && isDependency) {
        const activeSession = getCollectionActiveSession(api.getState());
        const targetProfileId = currentProfile?.id;

        // Check if any existing mod variant is enabled in a profile OTHER than the target profile
        const profiles = Object.values(state.persistent.profiles).filter(
          (prof) => prof.gameId === gameId && prof.id !== targetProfileId,
        );
        const isEnabledInOtherProfile = modIds.some((modId) =>
          profiles.some((prof) =>
            getSafe(prof.modState, [modId, "enabled"], false),
          ),
        );

        if (isEnabledInOtherProfile && activeSession?.collectionId != null) {
          // Create a variant so the other profile keeps its version
          const collectionMod =
            api.getState().persistent.mods?.[gameId]?.[
              activeSession.collectionId
            ];
          const variantNum = installOptions.variantNumber?.toString() ?? "1";
          const maxLength = MAX_VARIANT_NAME - variantNum.length + 1;
          const rawName =
            collectionMod?.attributes?.customFileName?.trim() ?? "";
          const autoVariant =
            rawName.length > maxLength
              ? `${rawName.substring(0, maxLength)}.${variantNum}`
              : `${rawName}.${variantNum}`;
          choices = Bluebird.resolve({
            action: "variant",
            variant: autoVariant,
            remember: false,
          });
        } else {
          // No other profile uses this mod, safe to replace
          choices = Bluebird.resolve({ action: "replace", remember: false });
        }
      } else {
        choices = choices ?? queryDialog();
      }

      choices
        .then(
          (result: { action: string; variant: string; remember: boolean }) => {
            const wasEnabled = (modId: string) => {
              return currentProfile?.gameId === gameId
                ? getSafe(currentProfile.modState, [modId, "enabled"], false)
                : false;
            };

            const replaceMod = (modId: string) => {
              const mod = mods.find((m) => m.id === modId);
              const variant =
                mod !== undefined
                  ? getSafe(mod.attributes, ["variant"], "")
                  : "";
              api.events.emit(
                "remove-mod",
                gameId,
                modId,
                (err) => {
                  if (err !== null) {
                    reject(err);
                  } else {
                    resolve({
                      id: modId,
                      variant,
                      enable: wasEnabled(modId),
                      attributes: _.omit(mod.attributes, [
                        "version",
                        "fileName",
                        "fileVersion",
                      ]),
                      rules: mod.rules,
                      replaceChoice: "replace",
                    });
                  }
                },
                { willBeReplaced: true },
              );
            };

            if (result.action === "variant") {
              if (result.remember === true) {
                context?.set?.("replace-or-variant", "variant");
              }
              if (currentProfile !== undefined) {
                const actions = modIds.map((id) =>
                  setModEnabled(currentProfile.id, id, false),
                );
                batchDispatch(api.store.dispatch, actions);
              }
              // We want the shortest possible modId paired against this archive
              //  before adding the variant name to it.
              const archiveId = mods[0].archiveId;
              const relevantIds = Object.keys(
                state.persistent.mods[gameId],
              ).filter(
                (id) =>
                  state.persistent.mods[gameId][id]?.archiveId === archiveId,
              );
              const modId = relevantIds.reduce(
                (prev, iter) => (iter.length < prev.length ? iter : prev),
                relevantIds[0],
              );
              // We just disabled all variants - if any of the variants was enabled previously
              //  it's safe to assume that the user wants this new variant enabled.
              const enable = modIds.reduce(
                (prev, iter) => (wasEnabled(iter) ? true : prev),
                false,
              );
              resolve({
                id: modId + "+" + result.variant,
                variant: result.variant,
                enable,
                attributes: {},
                rules: [],
                replaceChoice: "variant",
              });
            } else if (result.action === "replace") {
              if (result.remember === true) {
                context?.set?.("replace-or-variant", "replace");
              }
              if (modIds.length > 1) {
                queryVariantReplacement().then((res: IDialogResult) => {
                  if (res.action === "Cancel") {
                    context?.set?.("canceled", true);
                    reject(new UserCanceled());
                  } else {
                    const selected = Object.keys(res.input).find(
                      (iter) => res.input[iter],
                    );
                    replaceMod(selected);
                  }
                });
              } else {
                replaceMod(modIds[0]);
              }
            } else {
              if (result.action === "Cancel") {
                log("error", 'invalid action in "queryUserReplace"', {
                  action: result.action,
                });
              }
              context?.set?.("canceled", true);
              reject(new UserCanceled());
            }
          },
        )
        .tap(() => {
          if (context !== undefined) {
            context.set(
              "items-completed",
              context.get("items-completed", 0) + 1,
            );
          }
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }
}
