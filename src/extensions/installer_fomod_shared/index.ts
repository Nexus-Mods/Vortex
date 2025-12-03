import InstallerDialog from './views/InstallerDialog';
import { installerUIReducer } from './reducers/installerUI';
import { initGameSupport } from './utils/gameSupport';
import { IChoiceType } from './types/interface';
import { IExtensionContext } from '../../types/IExtensionContext';
import { IMod } from '../mod_management/types/IMod';
import { getSafe } from '../../util/storeHelper';

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
      const options = Object.values(choices.options || {}).flatMap(step =>
        step.groups
          .filter(group => group.choices.length > 0)
          .map(group =>
            `${group.name} = ${group.choices.map(choice => choice.name).join(', ')}`));
      if (options.length === 0) {
        return '<None>';
      }
      return options;
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
