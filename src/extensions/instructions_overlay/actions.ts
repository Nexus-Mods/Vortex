import safeCreateAction from '../../actions/safeCreateAction';

import { IPosition } from '../../types/api';

export const showOverlay = safeCreateAction('SHOW_INSTRUCTIONS',
  (id: string, title: string, instructions: string, pos: IPosition) =>
    ({ id, title, instructions, pos }));

export const dismissOverlay = safeCreateAction('DISMISS_INSTRUCTIONS',
  (id: string) => id);
