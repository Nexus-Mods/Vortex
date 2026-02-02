import * as ops from "./operations";
import settingsReducer from "./reducers";
import SettingsTheme from "./SettingsTheme";
import { getAvailableFonts, themesPath } from "./util";

import * as path from "path";
import { fs, log, types, util } from "vortex-api";

function applyTheme(api: types.IExtensionApi, theme: string, initial: boolean) {
  if (!initial) {
    api.clearStylesheet();
  }

  if (theme === null) {
    api.setStylesheet("variables", undefined);
    api.setStylesheet("fonts", undefined);
    api.setStylesheet("style", undefined);
    return;
  }

  return util
    .readExtensibleDir("theme", path.join(__dirname, "themes"), themesPath())
    .then((themes) => {
      const selected = themes.find((iter) => path.basename(iter) === theme);
      if (selected === undefined) {
        return Promise.resolve();
      }

      return fs
        .statAsync(path.join(selected, "variables.scss"))
        .then(() =>
          api.setStylesheet("variables", path.join(selected, "variables")),
        )
        .catch(() => api.setStylesheet("variables", undefined))
        .then(() => fs.statAsync(path.join(selected, "details.scss")))
        .then(() =>
          api.setStylesheet("details", path.join(selected, "details")),
        )
        .catch(() => api.setStylesheet("details", undefined))
        .then(() => fs.statAsync(path.join(selected, "fonts.scss")))
        .then(() => api.setStylesheet("fonts", path.join(selected, "fonts")))
        .catch(() => api.setStylesheet("fonts", undefined))
        .then(() => fs.statAsync(path.join(selected, "style.scss")))
        .then(() => api.setStylesheet("style", path.join(selected, "style")))
        .catch(() => api.setStylesheet("style", undefined));
    });
}

function editStyle(api: types.IExtensionApi, themeName: string): Promise<void> {
  const stylePath = path.join(ops.themePath(themeName), "style.scss");
  return fs.ensureFileAsync(stylePath).then(() =>
    util
      .opn(stylePath)
      .catch(util.MissingInterpreter, (err) => {
        api.showDialog(
          "error",
          "No handler found",
          {
            text:
              "You don't have an editor associated with scss files. " +
              "You can fix this by opening the following file from your file explorer, " +
              "pick your favorite text editor and when prompted, choose to always open " +
              "that file type with that editor.",
            message: err.url,
          },
          [{ label: "Close" }],
        );
      })
      .catch((err) => {
        log("error", "failed to open", err);
      }),
  );
}

function init(context: types.IExtensionContext) {
  context.registerReducer(["settings", "interface"], settingsReducer);

  const onCloneTheme = (themeName: string, newName: string) =>
    ops.cloneTheme(context.api, themeName, newName);
  const onSelectTheme = (theme: string) => ops.selectTheme(context.api, theme);
  const saveTheme = (
    themeName: string,
    variables: { [name: string]: string },
  ) => ops.saveTheme(context.api, themeName, variables);
  const removeTheme = (themeName: string) =>
    ops.removeTheme(context.api, themeName);
  const onEditStyle = (themeName: string) => editStyle(context.api, themeName);

  context.registerSettings("Theme", SettingsTheme, () => ({
    readThemes: ops.readThemes,
    onCloneTheme,
    onSelectTheme,
    readThemeVariables: ops.readThemeVariables,
    onSaveTheme: saveTheme,
    onRemoveTheme: removeTheme,
    locationToName: ops.themeName,
    nameToLocation: ops.themePath,
    isThemeCustom: ops.isThemeCustom,
    onEditStyle,
    getAvailableFonts,
  }));

  context.once(() => {
    const store = context.api.store;

    context.api.events.on("select-theme", (selectedThemePath: string) => {
      applyTheme(context.api, selectedThemePath, false);
    });

    return applyTheme(
      context.api,
      store.getState().settings.interface.currentTheme,
      true,
    );
  });

  return true;
}

export default init;
