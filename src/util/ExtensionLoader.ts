import initAboutDialog from '../extensions/about_dialog/index';
import initSettingsInterface from '../extensions/settings_interface/index';
import { IExtensionInit } from '../types/Extension';
import { log } from '../util/log';

import { app as appIn, remote } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

let app = appIn;

if (app === undefined) {
  app = remote.app;
}

function loadDynamicExtension(extensionPath: string): IExtensionInit {
  let indexPath = path.join(extensionPath, 'index.js');
  if (fs.existsSync(indexPath)) {
    return require(indexPath).default;
  } else {
    return undefined;
  }
}

function loadDynamicExtensions(extensionsPath: string): IExtensionInit[] {
  if (!fs.existsSync(extensionsPath)) {
    log('warn', 'failed to load dynamic extensions, path doesn\'t exist', extensionsPath);
    return [];
  }

  let res = fs.readdirSync(extensionsPath)
    .filter((name) => fs.statSync(path.join(extensionsPath, name)).isDirectory())
    .map((name) => {
      try {
        return loadDynamicExtension(path.join(extensionsPath, name));
      } catch (err) {
        log('warn', 'failed to load dynamic extension', err);
        return undefined;
      }
    });
  return res.filter((func: IExtensionInit) => func !== undefined);
}

function loadExtensions(): IExtensionInit[] {
  const extensionsPath = path.join(app.getPath('userData'), 'plugins');
  return [
    initSettingsInterface,
    initAboutDialog,
  ].concat(loadDynamicExtensions(extensionsPath));
}

export default loadExtensions;
