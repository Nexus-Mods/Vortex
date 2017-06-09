import settingsReducer from './reducers';
import SettingsTheme from './SettingsTheme';
import { themeDir } from './util';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { types, util } from 'nmm-api';
import * as path from 'path';

function applyTheme(api: types.IExtensionApi, theme: string) {
  if (theme === null) {
    api.setStylesheet('variables', undefined);
    api.setStylesheet('fonts', undefined);
    api.setStylesheet('style', undefined);
  }

  const themePath = path.join(themeDir(), theme);

  fs.statAsync(path.join(themePath, 'variables.scss'))
    .then(() => api.setStylesheet('variables', path.join(themePath, 'variables')))
    .catch(() => api.setStylesheet('variables', undefined));

  fs.statAsync(path.join(themePath, 'fonts.scss'))
    .then(() => api.setStylesheet('fonts', path.join(themePath, 'fonts')))
    .catch(() => api.setStylesheet('fonts', undefined));

  fs.statAsync(path.join(themePath, 'style.scss'))
    .then(() => api.setStylesheet('style', path.join(themePath, 'style')))
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
