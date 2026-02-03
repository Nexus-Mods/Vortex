import type { IExtensionContext } from "../../types/IExtensionContext";

import AddModDialog from "./components/AddModDialog";
import { showAddModDialog } from "./actions/session";
import { sessionReducer } from "./reducers/session";

/**
 * Entry point for the add_new_mod extension.
 * Registers a "Create new mod" action that opens a styled modal dialog
 * allowing users to create empty mods for manual file management.
 */
function init(context: IExtensionContext): boolean {
  // Register the session reducer for dialog visibility state
  context.registerReducer(["session", "addNewMod"], sessionReducer);

  // Register the dialog component
  context.registerDialog("add-new-mod", AddModDialog, () => ({
    api: context.api,
  }));

  // Register the toolbar action
  context.registerAction(
    "mod-icons",
    50,
    "add",
    {},
    "Create new mod",
    () => {
      context.api.store?.dispatch(showAddModDialog(true));
    },
    () => true,
  );

  return true;
}

export default init;
