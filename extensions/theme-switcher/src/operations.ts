import * as path from 'path';
import { fs, log, types, util } from 'vortex-api';

import * as actions from './actions';
import { themesPath } from './util';

let themes: string[] = [];

export function readThemes() {
  const bundledPath = path.join(__dirname, 'themes');
  return util.readExtensibleDir('theme', bundledPath, themesPath())
    .tap(extThemes => {
      themes = extThemes;
    });
}

export function themeName(location: string): string {
  return path.basename(location);
}

export function themePath(themeName: string): string | undefined {
  themeName = themeName.replace(/^__/, '');
  return themes.find(theme => path.basename(theme) === themeName);
}

function saveThemeInternal(outputPath: string, variables: { [name: string]: string }) {
  const theme = Object.keys(variables)
    .map(name => `\$${name}: ${variables[name]};`);
  return fs.writeFileAsync(
    path.join(outputPath, 'variables.scss'),
    '// Automatically generated. Changes to this file will be overwritten.\r\n'
    + theme.join('\r\n'));
}

export function saveTheme(api: types.IExtensionApi, themeName: string,
                          variables: { [name: string]: string }) {
  const t = api.translate;

  saveThemeInternal(path.join(themesPath(), themeName), variables)
    .then(() => {
      api.events.emit('select-theme', themeName);
    })
    .catch(err => {
      api.showErrorNotification(
        t('Unable to save theme'), err,
        // Theme directory should have been present at this point but was removed
        //  by an external factor. This could be due to:
        // (Anti Virus, manually removed by mistake, etc); this is not Vortex's fault.
        { allowReport: (err as any).code !== 'ENOENT' });
    });
}

export function selectTheme(api: types.IExtensionApi, theme: string) {
  api.store.dispatch(actions.selectTheme(theme));
  api.events.emit('select-theme', theme);
}

export function cloneTheme(api: types.IExtensionApi, themeName: string,
                           newName: string): Promise<void> {
  const t = api.translate;

  if (newName && (themes.findIndex(iter => path.basename(iter) === newName) === -1)) {
    const targetPath = path.join(themesPath(), newName);
    const sourcePath = themePath(themeName);
    if (sourcePath === undefined) {
      return Promise.reject(new Error('no path for current theme'));
    }
    api.events.emit('analytics-track-click-event', 'Themes', 'Clone theme');

    return fs.ensureDirAsync(targetPath)
      .then(() => readThemeVariables(themeName))
      .then(variables =>
        saveThemeInternal(path.join(themesPath(), newName), variables))
      .then(() => (sourcePath !== undefined)
        ? fs.readdirAsync(sourcePath)
        : Promise.resolve([]))
      .map(files => fs.copyAsync(path.join(sourcePath, files), path.join(targetPath, files)))
      .then(() => {
        themes.push(targetPath);
        selectTheme(api, newName);
      })
      .catch(err => api.showErrorNotification(
        t('Failed to read theme directory'),
        err,
        // Theme directory has been removed by an external method -
        // (Anti Virus, manually removed by mistake, etc); this is not Vortex's fault.
        { allowReport: (err as any).code !== 'ENOENT' }));
  } else {
    return Promise.reject(new util.ArgumentInvalid('Name already used'));
    // cloneTheme(api, themeName, themes, t('Name already used.'));
  }
}

export function readThemeVariables(themeName: string): Promise<{ [key: string]: string }> {
  const currentThemePath = themePath(themeName);
  if (currentThemePath === undefined) {
    // likely was deleted outside Vortex
    log('warn', 'theme not found', themeName);
    return Promise.resolve({});
  }
 
  return fs.readFileAsync(path.join(currentThemePath, 'variables.scss'))
    .then(data => {
      const variables = {};
      data.toString('utf-8').split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (value !== undefined) {
          variables[key.substr(1)] = value.trim().replace(/;*$/, '');
        }
      });
      return variables;
    })
    // an exception indicates no variables set. that's fine, defaults are used
    .catch(() => {
      return {};
    });
}

export function removeTheme(api: types.IExtensionApi, themeName: string) {
  selectTheme(api, 'default');
  const currentThemePath = themePath(themeName);
  this.nextState.themes = themes
    .filter(iter => iter !== currentThemePath);
  return fs.removeAsync(currentThemePath)
    .then(() => {
      log('info', 'removed theme', themeName);
    })
    .catch(err => {
      log('error', 'failed to remove theme', { err });
    });
}

export function isThemeCustom(themeName: string): boolean {
  const themeFilePath = themePath(themeName);
  if (themeFilePath === undefined) {
    // We don't have the filepath to this theme..
    //  possibly a race condition ? if so, this should
    //  clear up next time the state updates.
    //  https://github.com/Nexus-Mods/Vortex/issues/7191
    //
    // the above issue was in the remove callback so the likely scenario is
    // that that event was triggered twice and on the second time it was handled
    // the theme is already gone.
    return false;
  }

  // isChildPath plays a bit fast and loose when it comes to directory normalization
  // if we don't pass in a normalizer, but that shouldn't be a problem here, the official
  // themes are in the application folder and the themes are in APPDATA or ProgramData so
  // upper/lower case shouldn't be that big of a deal
  return util.isChildPath(themeFilePath, themesPath());
}
