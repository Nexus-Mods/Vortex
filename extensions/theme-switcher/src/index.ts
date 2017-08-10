import settingsReducer from './reducers';
import SettingsTheme from './SettingsTheme';
import { themePath } from './util';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { types, util } from 'vortex-api';

function applyTheme(api: types.IExtensionApi, theme: string) {
  if (theme === null) {
    api.setStylesheet('variables', undefined);
    api.setStylesheet('fonts', undefined);
    api.setStylesheet('style', undefined);
  }

  const fullThemePath: string = theme.startsWith('__')
    ? path.join(__dirname, 'themes', theme.slice(2))
    : path.join(themePath(), theme);

  fs.statAsync(path.join(fullThemePath, 'variables.scss'))
    .then(() => api.setStylesheet('variables', path.join(fullThemePath, 'variables')))
    .catch(() => api.setStylesheet('variables', undefined));

  fs.statAsync(path.join(fullThemePath, 'fonts.scss'))
    .then(() => api.setStylesheet('fonts', path.join(fullThemePath, 'fonts')))
    .catch(() => api.setStylesheet('fonts', undefined));

  fs.statAsync(path.join(fullThemePath, 'style.scss'))
    .then(() => api.setStylesheet('style', path.join(fullThemePath, 'style')))
    .catch(() => api.setStylesheet('style', undefined));
}

function init(context: types.IExtensionContext) {
  context.registerSettings('Interface', SettingsTheme);
  context.registerReducer(['settings', 'interface'], settingsReducer);

  context.once(() => {
    const store = context.api.store;

    context.api.events.on('select-theme', (theme: string) => {
      applyTheme(context.api, theme);
    });

    applyTheme(context.api, store.getState().settings.interface.currentTheme);
  });

  return true;
}

export default init;
