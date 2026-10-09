import { useCallback } from "react";

import { useMainContext } from "@/contexts";
import type { IState } from "@/types/IState";
import { getSafe } from "@/util/storeHelper";

import { activeGameId, activeProfile } from "../../../../util/selectors";
import type { IModWithState } from "../../types/IModProps";
import updateState from "../../util/modUpdateState";

/**
 * Checks the given mods for updates, then says how many have one, offering to update them to a
 * Premium user: the legacy table's Check for Update, for the mods it's asked about.
 */
export const useCheckModUpdate = () => {
  const { api } = useMainContext();

  return useCallback(
    async (modIds: string[]) => {
      const state: IState = api.getState();
      const gameId = activeGameId(state);
      const modState = activeProfile(state)?.modState ?? {};
      const mods = state.persistent.mods[gameId] ?? {};

      // keyed by mod id
      const checked: { [modId: string]: IModWithState } = {};
      modIds
        .filter((modId) => mods[modId] !== undefined)
        .forEach((modId) => {
          checked[modId] = {
            ...mods[modId],
            ...(modState[modId] ?? { enabled: false, enabledTime: 0 }),
          };
        });

      try {
        await api.emitAndAwait("check-mods-version", gameId, checked, true);
      } catch (err) {
        api.showErrorNotification("Error checking for mod updates", err);
        return;
      }

      const updated = api.getState().persistent.mods[gameId] ?? {};
      const outdated = Object.keys(checked).filter((modId) => {
        const mod = updated[modId];
        return (
          mod?.attributes != null &&
          updateState(mod.attributes) === "update" &&
          mod.type !== "collection" &&
          checked[modId].enabled
        );
      });

      const isPremium = getSafe<boolean>(
        api.getState(),
        ["persistent", "nexus", "userInfo", "isPremium"],
        false,
      );

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
                    api.events.emit("mods-update", gameId, outdated);
                  },
                },
              ]
            : undefined,
        displayMS: outdated.length === 0 ? 5000 : undefined,
      });
    },
    [api],
  );
};
