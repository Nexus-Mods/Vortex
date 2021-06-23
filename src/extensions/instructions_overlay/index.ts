import { IExtensionContext } from '../../types/IExtensionContext';
import { dismissOverlay, showOverlay } from './actions';
import Container from './Container';
import Reducer from './reducer';

function init(context: IExtensionContext): boolean {
  // bit of a hack, we're not actually rendering a dialog, the overlays are added via portal, we
  // just need any node that gets rendered
  context.registerOverlay('overlay', Container);
  context.registerReducer(['session', 'overlays'], Reducer);

  // not yet ready to make these official parts of the api
  context.registerAPI('showOverlay', (id: string, title: string, text: string) =>
    context.api.store.dispatch(showOverlay(id, title, text)), { minArguments: 3 });

  context.registerAPI('dismissOverlay', (id: string) =>
    context.api.store.dispatch(dismissOverlay(id)), { minArguments: 1 });

  return true;
}

export default init;
