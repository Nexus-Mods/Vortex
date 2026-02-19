import { useMemo } from "react";

import type ExtensionManager from "../../../ExtensionManager";
import type {
  IActionDefinition,
  IActionOptions,
} from "../../../types/IActionDefinition";

/**
 * Custom hook to fetch and sort global-icons actions from extensions.
 * These are actions registered by extensions to appear in global UI areas.
 * Filters out actions marked with classicOnly: true since the Modern UI
 * has its own built-in alternatives.
 *
 * @param extensions - The extension manager instance
 * @returns Sorted array of global-icons action definitions (excluding classicOnly actions)
 */
export const useGlobalIconActions = (
  extensions: ExtensionManager,
): IActionDefinition[] => {
  return useMemo(() => {
    const actions: IActionDefinition[] = [];

    extensions.apply(
      "registerAction",
      (
        _extInfo,
        group: string,
        position: number,
        iconOrComponent: string,
        options: IActionOptions,
        title: string,
        action: () => void,
      ) => {
        if (
          group === "global-icons" &&
          typeof iconOrComponent === "string" &&
          !options?.isClassicOnly
        ) {
          actions.push({
            icon: iconOrComponent,
            title,
            position,
            action,
            options,
          });
        }
      },
      true,
    );

    return actions.sort((a, b) => (a.position ?? 100) - (b.position ?? 100));
  }, [extensions]);
};
