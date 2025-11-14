import * as fs from 'fs';
import * as path from 'path';
const debugLog = (msg: string) => {
  try {
    const logPath = path.join(process.env.APPDATA || process.env.USERPROFILE || 'C:\\', 'vortex_fomod_debug.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
  } catch (err) {
    // Ignore errors
  }
};

debugLog('[FOMOD_SHARED] ===== MODULE LOADING START =====');
import InstallerDialog from './views/InstallerDialog';
debugLog('[FOMOD_SHARED] InstallerDialog imported');
import { installerUIReducer } from './reducers/installerUI';
debugLog('[FOMOD_SHARED] installerUIReducer imported');
import { initGameSupport } from './utils/gameSupport';
debugLog('[FOMOD_SHARED] initGameSupport imported');
import { IChoiceType } from './types/interface';
debugLog('[FOMOD_SHARED] IChoiceType imported');

import { IExtensionContext } from '../../types/IExtensionContext';
import { IMod } from '../mod_management/types/IMod';
debugLog('[FOMOD_SHARED] IMod and IExtensionContext imported');
import { getSafe } from '../../util/storeHelper';
debugLog('[FOMOD_SHARED] getSafe imported');
import { log } from '../../util/log';
debugLog('[FOMOD_SHARED] ===== MODULE LOADING COMPLETE =====');

function init(context: IExtensionContext): boolean {
  log('info', '========== [FOMOD_SHARED] Extension initialization STARTED ==========');

  initGameSupport(context.api);
  log('info', '[FOMOD_SHARED] Game support initialized');

  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);
  log('info', '[FOMOD_SHARED] Reducer registered');

  context.registerDialog('fomod-installer', InstallerDialog);
  log('info', '[FOMOD_SHARED] Dialog registered');

  context.registerTableAttribute('mods', {
    id: 'installer',
    name: 'Installer',
    description: 'Choices made in the installer',
    icon: 'inspect',
    placement: 'detail',
    calc: (mod: IMod) => {
      const choices = getSafe<IChoiceType | undefined>(mod.attributes, ['installerChoices'], undefined);
      if ((choices === undefined) || (choices.type !== 'fomod')) {
        return '<None>';
      }
      return (choices.options || []).reduce((prev, step) => {
        prev.push(...step.groups
          .filter(group => group.choices.length > 0)
          .map(group =>
            `${group.name} = ${group.choices.map(choice => choice.name).join(', ')}`));
        return prev;
      }, Array<string>());
    },
    edit: {},
    isDefaultVisible: false,
  });

  // This attribute extractor is reading and parsing xml files just for the sake
  //  of finding the fomod's name - it's not worth the hassle.
  // context.registerAttributeExtractor(75, processAttributes);

  log('info', '[FOMOD_SHARED] Table attribute registered');
  log('info', '========== [FOMOD_SHARED] Extension initialization COMPLETE ==========');
  return true;
}

export default init;
