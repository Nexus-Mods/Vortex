import InstallerDialog from './views/InstallerDialog';

import { IChoiceType } from '../installer_fomod_shared/types/interface';
import {
  initGameSupport,
} from '../installer_fomod_shared/util/gameSupport';
import { IExtensionContext, IMod } from '../../types/api';
import { getSafe } from '../../util/api';
import { installerUIReducer } from './reducers/installerUI';

function init(context: IExtensionContext): boolean {
  initGameSupport(context.api);

  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);
 
  context.registerDialog('fomod-installer', InstallerDialog);

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
        const values = step.groups
          .filter(group => group.choices.length > 0)
          .map(group => `${group.name} = ${group.choices.map(choice => choice.name).join(', ')}`)
        prev.push(...values);
        return prev;
      }, Array<string>());
    },
    edit: {},
    isDefaultVisible: false,
  });

  // This attribute extractor is reading and parsing xml files just for the sake
  //  of finding the fomod's name - it's not worth the hassle.
  // context.registerAttributeExtractor(75, processAttributes);

  return true;
}

export default init;
