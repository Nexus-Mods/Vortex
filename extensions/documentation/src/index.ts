import DocumentationPage from './DocumentationPage';

import { types } from 'nmm-api';

function init(context: types.IExtensionContext) {

  context.registerMainPage('book', 'Documentation', DocumentationPage, {
    hotkey: 'H',
    group: 'support',
  });

  return true;
}

export default init;
