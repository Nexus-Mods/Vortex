import { actions, selectors, type types } from "@nexusmods/vortex-api";

import { enabledModIds } from "../selectors";
import { hasModTypeConflictOverrides } from "./fileOverrides";

const NOTIFICATION_ID = "mod-type-conflict-dependencies-column";
const MODS_TABLE_ID = "mods";
const DEPENDENCIES_COLUMN_ID = "dependencies";

/** Recommends the Dependencies column while it is hidden. */
export default function notifyModTypeConflict(
  api: Pick<types.IExtensionApi, "getState" | "store" | "sendNotification" | "dismissNotification">,
): void {
  const state = api.getState();
  const columnVisible =
    state.settings.tables?.[MODS_TABLE_ID]?.attributes?.[DEPENDENCIES_COLUMN_ID]?.enabled ?? false;
  const wanted =
    !columnVisible &&
    hasModTypeConflictOverrides(
      selectors.modsForActiveGame(state),
      enabledModIds(state),
      state.session?.["dependencies"]?.conflicts ?? {},
    );
  const shown = (state.session.notifications?.notifications ?? []).some(
    (notification) => notification.id === NOTIFICATION_ID,
  );
  if (wanted === shown) {
    return;
  }
  if (!wanted) {
    api.dismissNotification(NOTIFICATION_ID);
    return;
  }
  api.sendNotification({
    id: NOTIFICATION_ID,
    type: "info",
    message: "You have a mod type conflict. Show the Dependencies column to manage it.",
    allowSuppress: true,
    actions: [
      {
        title: "Show column",
        action: (dismiss) => {
          api.store.dispatch(
            actions.setAttributeVisible(MODS_TABLE_ID, DEPENDENCIES_COLUMN_ID, true),
          );
          dismiss();
        },
      },
    ],
  });
}
