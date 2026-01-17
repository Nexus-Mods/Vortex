/**
 * InstructionDispatcher - Handles Redux-based instruction dispatch operations.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Attribute setting instructions
 * - Enable all plugins instructions
 * - Mod type setting instructions
 * - Rule processing instructions
 *
 * These functions dispatch Redux actions based on installation instructions
 * produced by mod installers.
 */

import Bluebird from "bluebird";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { batchDispatch } from "../../../util/util";
import { log } from "../../../util/log";

import { addModRule, setModAttribute, setModType } from "../actions/mods";
import type { IInstruction } from "../types/IInstallResult";

/**
 * Interface for context that can set mod type.
 * This is a minimal interface to allow flexible dependency injection
 * without coupling to the full InstallContext class.
 */
export interface IModTypeContext {
  setModType(id: string, modType: string): void;
}

/**
 * Process attribute instructions by dispatching setModAttribute actions.
 *
 * @param api - Extension API
 * @param attributes - Array of attribute instructions
 * @param gameId - Game ID
 * @param modId - Mod ID
 * @returns Promise that resolves when complete
 */
export function processAttribute(
  api: IExtensionApi,
  attributes: IInstruction[],
  gameId: string,
  modId: string,
): Bluebird<void> {
  attributes.forEach((attr) => {
    api.store.dispatch(setModAttribute(gameId, modId, attr.key, attr.value));
  });
  return Bluebird.resolve();
}

/**
 * Process enable all plugins instruction by setting the enableallplugins attribute.
 *
 * @param api - Extension API
 * @param enableAll - Array of enableallplugins instructions
 * @param gameId - Game ID
 * @param modId - Mod ID
 * @returns Promise that resolves when complete
 */
export function processEnableAllPlugins(
  api: IExtensionApi,
  enableAll: IInstruction[],
  gameId: string,
  modId: string,
): Bluebird<void> {
  if (enableAll.length > 0) {
    api.store.dispatch(
      setModAttribute(gameId, modId, "enableallplugins", true),
    );
  }
  return Bluebird.resolve();
}

/**
 * Process set mod type instructions by dispatching setModType action.
 *
 * If multiple mod type instructions are provided, only the last one is used
 * and a warning is logged.
 *
 * @param api - Extension API
 * @param installContext - Install context for updating mod type
 * @param types - Array of setmodtype instructions
 * @param gameId - Game ID
 * @param modId - Mod ID
 * @returns Promise that resolves when complete
 */
export function processSetModType(
  api: IExtensionApi,
  installContext: IModTypeContext,
  types: IInstruction[],
  gameId: string,
  modId: string,
): Bluebird<void> {
  if (types.length > 0) {
    const type = types[types.length - 1].value;
    installContext.setModType(modId, type);
    api.store.dispatch(setModType(gameId, modId, type));
    if (types.length > 1) {
      log("error", "got more than one mod type, only the last was used", {
        types,
      });
    }
  }
  return Bluebird.resolve();
}

/**
 * Process rule instructions by dispatching batched addModRule actions.
 *
 * @param api - Extension API
 * @param rules - Array of rule instructions
 * @param gameId - Game ID
 * @param modId - Mod ID
 */
export function processRule(
  api: IExtensionApi,
  rules: IInstruction[],
  gameId: string,
  modId: string,
): void {
  const batched = rules.reduce((acc, rule) => {
    acc.push(addModRule(gameId, modId, rule.rule));
    return acc;
  }, [] as any[]);
  batchDispatch(api.store, batched);
}

/**
 * InstructionDispatcher class - provides instruction dispatch utilities.
 *
 * This class wraps the standalone functions for cases where a class-based
 * interface is preferred.
 */
export class InstructionDispatcher {
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  /**
   * Process attribute instructions.
   */
  public processAttribute(
    attributes: IInstruction[],
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    return processAttribute(this.mApi, attributes, gameId, modId);
  }

  /**
   * Process enable all plugins instruction.
   */
  public processEnableAllPlugins(
    enableAll: IInstruction[],
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    return processEnableAllPlugins(this.mApi, enableAll, gameId, modId);
  }

  /**
   * Process set mod type instructions.
   */
  public processSetModType(
    installContext: IModTypeContext,
    types: IInstruction[],
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    return processSetModType(this.mApi, installContext, types, gameId, modId);
  }

  /**
   * Process rule instructions.
   */
  public processRule(
    rules: IInstruction[],
    gameId: string,
    modId: string,
  ): void {
    return processRule(this.mApi, rules, gameId, modId);
  }
}
