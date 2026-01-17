/**
 * ModNamingStateMachine - Handles mod naming conflict resolution via an explicit state machine.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module converts the recursive checkNameLoop function into an explicit state machine,
 * making the control flow clearer and easier to test.
 *
 * States:
 * - check_name: Check if the current name conflicts with existing mods
 * - prompt_user: Show dialog asking user how to resolve the conflict
 * - resolved: Final state with the resolved mod ID and any side effects
 */

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IRule } from "../types/IMod";
import { log } from "../../../util/log";

import { checkModNameExists, checkModVariantsExist } from "./ModLookupService";
import type { UserDialogManager } from "./UserDialogManager";
import type { IReplaceChoice } from "./types/IInstallationEntry";

/**
 * Possible replacement choices from user dialog
 */
export type ReplaceChoice = "replace" | "variant" | undefined;

/**
 * Context for the naming state machine.
 * Contains all the mutable state needed during name resolution.
 */
export interface INamingContext {
  /** The API instance */
  api: IExtensionApi;
  /** The game ID for the mod */
  gameId: string;
  /** The archive ID being installed */
  archiveId: string;
  /** The initial/current mod ID being tested */
  modId: string;
  /** Counter for variant naming */
  variantCounter: number;
  /** Current replacement choice */
  replacementChoice: ReplaceChoice;
  /** Whether installation is unattended */
  unattended: boolean;
  /** File list for the mod */
  fileList: any;
  /** Install choices (can be cleared) */
  choices: any;
  /** Install patches (can be cleared) */
  patches: any;
}

/**
 * Options passed to user dialog
 */
export interface INamingDialogOptions {
  unattended?: boolean;
  fileList?: any;
  choices?: any;
  patches?: any;
  variantNumber?: number;
}

/**
 * Result of the naming state machine
 */
export interface INamingResult {
  /** The resolved mod ID */
  modId: string;
  /** Whether the mod should be enabled */
  enable: boolean;
  /** Rules to apply */
  rules: IRule[];
  /** Custom variant name */
  variant?: string;
  /** Previous mod attributes (when replacing) */
  previous?: any;
  /** Whether choices should be cleared */
  clearChoices: boolean;
  /** Whether patches should be cleared */
  clearPatches: boolean;
  /** Whether file list should be cleared */
  clearFileList: boolean;
}

/**
 * State types for the naming state machine
 */
type NamingState =
  | { type: "check_name" }
  | { type: "prompt_user"; existingIds: string[] }
  | { type: "resolved"; result: INamingResult };

/**
 * ModNamingStateMachine - Explicit state machine for resolving mod naming conflicts.
 *
 * Replaces the recursive checkNameLoop pattern with a clear state machine that:
 * - Has explicit state transitions
 * - Is easier to test
 * - Is easier to extend with new states
 */
export class ModNamingStateMachine {
  private mUserDialogManager: UserDialogManager;

  constructor(userDialogManager: UserDialogManager) {
    this.mUserDialogManager = userDialogManager;
  }

  /**
   * Resolve mod naming conflicts using a state machine approach.
   *
   * @param ctx - The naming context
   * @returns Promise resolving to the naming result
   */
  public async resolve(ctx: INamingContext): Promise<INamingResult> {
    let state: NamingState = { type: "check_name" };
    let testModId = ctx.modId;
    let variantCounter = ctx.variantCounter;
    let replacementChoice = ctx.replacementChoice;

    // Default result values
    let enable = false;
    let rules: IRule[] = [];
    let variant: string | undefined;
    let previous: any;
    let clearChoices = false;
    let clearPatches = false;
    let clearFileList = false;

    // Run state machine until we reach resolved state
    while (state.type !== "resolved") {
      switch (state.type) {
        case "check_name": {
          // Check if we should skip to resolved (already decided to replace)
          if (replacementChoice === "replace") {
            log("debug", '(nameloop) replacement choice "replace"', {
              testModId: testModId ?? "<undefined>",
            });
            state = {
              type: "resolved",
              result: {
                modId: testModId,
                enable,
                rules,
                variant,
                previous,
                clearChoices,
                clearPatches,
                clearFileList,
              },
            };
            break;
          }

          // Check for name conflicts
          const modNameMatches = checkModNameExists(
            testModId,
            ctx.api,
            ctx.gameId,
          );
          const variantMatches = checkModVariantsExist(
            ctx.api,
            ctx.gameId,
            ctx.archiveId,
          );

          const existingIds = (
            replacementChoice === "variant"
              ? modNameMatches
              : Array.from(
                  new Set(
                    ([] as string[]).concat(modNameMatches, variantMatches),
                  ),
                )
          ).filter((id) => id !== undefined);

          if (existingIds.length === 0) {
            log("debug", "(nameloop) no existing ids", {
              testModId: testModId ?? "<undefined>",
            });
            state = {
              type: "resolved",
              result: {
                modId: testModId,
                enable,
                rules,
                variant,
                previous,
                clearChoices,
                clearPatches,
                clearFileList,
              },
            };
          } else {
            state = { type: "prompt_user", existingIds };
          }
          break;
        }

        case "prompt_user": {
          variantCounter++;

          const dialogOptions: INamingDialogOptions = {
            unattended: ctx.unattended,
            fileList: ctx.fileList,
            choices: ctx.choices,
            patches: ctx.patches,
            variantNumber: variantCounter,
          };

          const choice: IReplaceChoice =
            await this.mUserDialogManager.queryUserReplace(
              state.existingIds,
              ctx.gameId,
              dialogOptions,
            );

          if (choice.id === undefined) {
            log("error", "(nameloop) no valid id selection", {
              testModId,
              existingIds: state.existingIds,
            });
          }

          // Update state from choice
          testModId = choice.id;
          replacementChoice = choice.replaceChoice;

          if (choice.enable) {
            enable = true;
          }

          // When user chooses to replace or create a variant, clear any pre-set
          // installer options so they get a fresh installation experience
          // (only when not in an active collection session)
          const activeSession = this.getCollectionActiveSession(ctx.api);
          if (!activeSession) {
            clearChoices = true;
            clearPatches = true;
            clearFileList = true;
          }

          variant = choice.variant;
          rules = choice.rules || [];
          previous = choice.attributes;

          // Go back to check_name to loop
          state = { type: "check_name" };
          break;
        }
      }
    }

    return state.result;
  }

  /**
   * Check if there's an active collection session.
   * This is extracted to allow mocking in tests.
   */
  private getCollectionActiveSession(api: IExtensionApi): any {
    // Import dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      getCollectionActiveSession,
    } = require("../../collections_integration/selectors");
    return getCollectionActiveSession(api.getState());
  }
}

/**
 * Create a naming context from install parameters.
 * Helper function to construct the context object.
 */
export function createNamingContext(
  api: IExtensionApi,
  gameId: string,
  archiveId: string,
  modId: string,
  unattended: boolean,
  fileList: any,
  choices: any,
  patches: any,
): INamingContext {
  return {
    api,
    gameId,
    archiveId,
    modId,
    variantCounter: 0,
    replacementChoice: undefined,
    unattended,
    fileList,
    choices,
    patches,
  };
}

/**
 * Apply the result of naming resolution to the install info.
 * Helper function to apply side effects from the state machine.
 */
export function applyNamingResult(
  result: INamingResult,
  fullInfo: any,
  fileListRef: { current: any },
): {
  modId: string;
  enable: boolean;
  rules: IRule[];
} {
  // Apply side effects
  if (result.clearChoices) {
    delete fullInfo.choices;
  }
  if (result.clearPatches) {
    delete fullInfo.patches;
  }
  if (result.clearFileList) {
    fileListRef.current = undefined;
  }

  // Set variant if provided
  if (result.variant !== undefined) {
    if (!fullInfo.custom) {
      fullInfo.custom = {};
    }
    fullInfo.custom.variant = result.variant;
  }

  // Set previous if provided
  if (result.previous !== undefined) {
    fullInfo.previous = result.previous;
  }

  return {
    modId: result.modId,
    enable: result.enable,
    rules: result.rules,
  };
}
