import { IExtensionContext } from '../../types/IExtensionContext';

import GamePicker from './GamePicker';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('gamepad', 'Games', GamePicker);

  return true;
}

export default init;
