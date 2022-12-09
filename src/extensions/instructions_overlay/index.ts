import { IExtensionContext } from '../../types/IExtensionContext';
import { dismissOverlay, showOverlay } from './actions';
import Container from './Container';
import Reducer from './reducer';

import { IOverlayOptions, IPosition } from '../../types/IState';

function init(context: IExtensionContext): boolean {
  const onClose = (id: string) => {
    const state = context.api.getState();
    const overlayInfo = state.session.overlays.overlays[id];
    context.api.store.dispatch(dismissOverlay(id));
    context.api.events.emit('did-dismiss-overlay', id, overlayInfo.options?.id);
  }

  // bit of a hack, we're not actually rendering a dialog, the overlays are added via portal, we
  // just need any node that gets rendered
  context.registerOverlay('overlay', Container, () => ({
    onClose,
  }));
  context.registerReducer(['session', 'overlays'], Reducer);

  // not yet ready to make these official parts of the api
  context.registerAPI('showOverlay',
    (id: string, title: string, content: string | React.ComponentType<any>, pos: IPosition = undefined, options: IOverlayOptions) =>
      context.api.store.dispatch(showOverlay(id, title, content, pos, options)), { minArguments: 3 });

  context.registerAPI('dismissOverlay', (id: string) => {
    onClose(id);
  }, { minArguments: 1 });

  return true;
}

export default init;
