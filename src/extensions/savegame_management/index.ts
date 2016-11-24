import { Savegames } from './components/Savegames';

import { IExtensionContext } from '../../types/IExtensionContext';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('clone', 'Save Games', Savegames, {
    hotkey: 'S',
  });

  return true;
}

export default init;
