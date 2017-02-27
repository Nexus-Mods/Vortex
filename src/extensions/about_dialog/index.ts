import { IExtensionContext } from '../../types/IExtensionContext';

import { sessionReducer } from './reducers/session';
import AboutButton from './views/AboutButton';

function init(context: IExtensionContext): boolean {

  context.registerReducer(['session', 'about'], sessionReducer);

  context.registerIcon('help-icons', AboutButton, () => {
    return null;
  });

  return true;
}

export default init;
