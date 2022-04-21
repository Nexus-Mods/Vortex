import safeCreateAction from '../../actions/safeCreateAction';

import { IOverlayOptions, IPosition } from '../../types/api';

export const showOverlay = safeCreateAction('SHOW_INSTRUCTIONS',
  (id: string, title: string, content: string | React.ComponentType<any>, pos: IPosition, options: IOverlayOptions) =>
    ({ id, title, content, pos, options }));

export const dismissOverlay = safeCreateAction('DISMISS_INSTRUCTIONS',
  (id: string) => id);
