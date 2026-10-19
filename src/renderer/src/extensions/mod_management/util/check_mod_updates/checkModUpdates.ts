import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { getSafe } from "@/util/storeHelper";

import { activeGameId, activeProfile } from "../../../../util/selectors";
import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import updateState from "../modUpdateState";

/** What the check found: how many updates, called collection updates when they all are. */
const updateMessage = (outdated: string[], mods: { [modId: string]: IMod }): string => {
  if (outdated.length === 0) {
    return "All mods up to date";
  }

  const kind = outdated.every((modId) => mods[modId].type === "collection") ? "collection" : "mod";
  return `${outdated.length} ${kind} update${outdated.length === 1 ? "" : "s"} available`;
};

/**
 * Checks the given mods for updates, then says how many have one, offering to update them to a
 * Premium user. An enabled collection's new revision counts, but only mods are offered to Update All.
 */
export const checkModUpdates = async (api: IExtensionApi, modIds: string[]): Promise<void> => {
  const state: IState = api.getState();
  const gameId = activeGameId(state);
  const modState = activeProfile(state)?.modState ?? {};
  const mods = state.persistent.mods[gameId] ?? {};

  // keyed by mod id
  const checked: { [modId: string]: IModWithState } = {};
  modIds
    .filter((modId) => !!mods[modId])
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
      mod?.attributes != null && updateState(mod.attributes) === "update" && checked[modId].enabled
    );
  });
  // mods-update updates mods; a collection updates from its own page
  const updatable = outdated.filter((modId) => updated[modId].type !== "collection");

  const isPremium = getSafe<boolean>(
    api.getState(),
    ["persistent", "nexus", "userInfo", "isPremium"],
    false,
  );

  api.sendNotification({
    id: "check-mods-version-complete",
    type: "success",
    message: updateMessage(outdated, updated),
    actions:
      isPremium && updatable.length > 0
        ? [
            {
              title: "Update All",
              action: (dismiss: () => void) => {
                dismiss();
                api.events.emit("mods-update", gameId, updatable);
              },
            },
          ]
        : undefined,
    displayMS: outdated.length === 0 ? 5000 : undefined,
  });
};
