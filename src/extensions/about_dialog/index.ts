import { IExtensionContext } from '../../types/IExtensionContext';

import AboutPage from './views/AboutPage';

function init(context: IExtensionContext): boolean {
  context.registerAction('global-icons', 200, 'about', {}, 'About', () => {
    context.api.events.emit('show-main-page', 'About');
  });

  context.registerMainPage('', 'About', AboutPage, { group: 'hidden' });

  return true;
}

export default init;
