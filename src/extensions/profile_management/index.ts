import { IExtensionContext } from '../../types/IExtensionContext';

import ProfileView from './views/ProfileView';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('clone', 'Profiles', ProfileView);

  return true;
}

export default init;
