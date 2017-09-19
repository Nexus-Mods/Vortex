import DocumentationPage from './DocumentationPage';

import { types } from 'vortex-api';

function init(context: types.IExtensionContext) {

  context.registerMainPage('support', 'Documentation', DocumentationPage, {
    hotkey: 'H',
    group: 'support',
  });

  return true;
}

export default init;
