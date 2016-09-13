import initAboutDialog from '../extensions/about_dialog/index';
import initSettingsInterface from '../extensions/settings_interface/index';
import { IExtensionInit } from '../types/Extension';

function loadExtensions(): IExtensionInit[] {
  return [
    initSettingsInterface,
    initAboutDialog,
  ];
}

export default loadExtensions;
