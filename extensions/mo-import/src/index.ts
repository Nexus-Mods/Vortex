import ImportDialog from "./views/ImportDialog";

import * as path from "path";
import { actions, selectors, types } from "vortex-api";

const isGameSupported = (context: types.IExtensionContext): boolean => {
  const state = context.api.store.getState();
  const gameId: string = selectors.activeGameId(state);
  return (
    [
      "skyrim",
      "skyrimse",
      "skyrimvr",
      "morrowind",
      "oblivion",
      "fallout3",
      "falloutnv",
      "fallout4",
      "fallout4vr",
      "enderal",
    ].indexOf(gameId) !== -1
  );
};

function init(context: types.IExtensionContext): boolean {
  if (process.platform !== "win32") {
    // not going to work on other platforms because some of the path resolution
    // assumes windows.
    return false;
  }

  context.registerDialog("mo-import", ImportDialog);

  context.registerAction(
    "mod-icons",
    120,
    "import",
    {},
    "Import From MO",
    () => {
      context.api.store.dispatch(actions.setDialogVisible("mo-import"));
    },
    () => isGameSupported(context),
  );

  context.once(() => {
    const store = context.api.store;
    context.api.setStylesheet(
      "mo-import",
      path.join(__dirname, "mo-import.scss"),
    );
  });

  return true;
}

export default init;
