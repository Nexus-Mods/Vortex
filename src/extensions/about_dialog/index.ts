import { IExtensionContext } from '../../types/IExtensionContext';

import AboutButton from './views/AboutButton';

function init(context: IExtensionContext): boolean {
  context.registerAction('help-icons', 200, AboutButton, {});

  return true;
}

export default init;
