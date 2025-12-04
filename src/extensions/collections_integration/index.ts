import { collectionInstallReducer } from './reducers/installTracking';
import { IExtensionContext } from '../../types/IExtensionContext';

function init(context: IExtensionContext) {

  context.registerReducer(['session', 'collections'], collectionInstallReducer);

  // We chose not to integrate collections into the core API to simplify debugging
  // and to keep the core API lean. However, we still want to provide the collections
  // functionality through the core extension system to simplify development and maintenance
  // particularly when tracking collection installations.
  context.once(() => {});

  return true;
}

export default init;