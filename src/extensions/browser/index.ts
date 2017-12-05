import { IExtensionContext } from '../../types/IExtensionContext';

import BrowserView from './views/BrowserView';

import { sessionReducer } from './reducers';

function init(context: IExtensionContext): boolean {
  context.registerDialog('browser', BrowserView);
  context.registerReducer(['session', 'browser'], sessionReducer);

  return true;
}

export default init;
