import safeCreateAction from "../../../actions/safeCreateAction";

/**
 * Action to show or hide the Add New Mod dialog
 */
export const showAddModDialog = safeCreateAction(
  "SHOW_ADD_MOD_DIALOG",
  (show: boolean) => show,
);
