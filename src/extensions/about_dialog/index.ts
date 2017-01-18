import {showDialog} from '../../actions/notifications';
import { IExtensionContext } from '../../types/IExtensionContext';

function init(context: IExtensionContext): boolean {
  context.registerIcon('help-icons', 'question', 'About', () => {
    const {translate} = context.api;
    const t = translate;
    context.api.store.dispatch(showDialog('info', t('About'), {
      message: t('Nexus Mod Manager 2'),
    }, {}));
  });

  return true;
}

export default init;
