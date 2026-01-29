import { setImportStep } from "./actions/session";
import { sessionReducer } from "./reducers/session";
import ImportDialog from "./views/ImportDialog";

import * as path from "path";
import { fs, selectors, types, util } from "vortex-api";

let appPath: string;

function nmmConfigExists(): boolean {
  try {
    if (appPath === undefined) {
      appPath = util.getVortexPath("appData");
    }
    const base = path.resolve(appPath, "..", "local", "Black_Tree_Gaming");
    fs.statSync(base);
    return true;
  } catch (err) {
    return false;
  }
}

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
      "monsterhunterworld",
      "witcher2",
      "witcher3",
      "xrebirth",
      "xcom2",
      "worldoftanks",
      "warthunder",
      "teso",
      "stateofdecay",
      "starbound",
      "legendsofgrimrock",
      "dragonsdogma",
      "dragonage",
      "dragonage2",
      "darksouls",
      "darksouls2",
      "breakingwheel",
      "nomanssky",
    ].indexOf(gameId) !== -1
  );
};

function init(context: types.IExtensionContext): boolean {
  if (process.platform !== "win32") {
    // not going to work on other platforms because some of the path resolution
    // assumes windows.
    return false;
  }

  context.registerReducer(["session", "modimport"], sessionReducer);

  const gameModeActive = (store) =>
    selectors.activeGameId(store.getState()) !== undefined ? true : false;

  context.registerDialog("nmm-import", ImportDialog, () => ({}));

  context.registerAction(
    "mod-icons",
    115,
    "import",
    {},
    "Import From NMM",
    () => {
      context.api.store.dispatch(setImportStep("start"));
    },
    () => isGameSupported(context),
  );

  context.registerToDo(
    "import-nmm",
    "search",
    () => ({}),
    "import",
    "Import from NMM",
    () => {
      context.api.store.dispatch(setImportStep("start"));
      context.api.events.emit(
        "analytics-track-click-event",
        "Dashboard",
        "NMM Import",
      );
    },
    () => nmmConfigExists() && gameModeActive(context.api.store),
    "",
    100,
  );

  context.once(() => {
    context.api.setStylesheet(
      "nmm-import-tool",
      path.join(__dirname, "import-tool.scss"),
    );
  });

  return true;
}

export default init;
