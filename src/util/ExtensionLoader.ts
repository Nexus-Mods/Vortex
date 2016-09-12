import initSettingsInterface from '../extensions/settings_interface/index';
import { IExtensionInit } from '../types/Extension';

function loadExtensions(): IExtensionInit[] {
  return [
    initSettingsInterface,
  ];
}

export default loadExtensions;
