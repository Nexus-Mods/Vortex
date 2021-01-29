import safeCreateAction from '../../actions/safeCreateAction';

export const showOverlay = safeCreateAction('SHOW_INSTRUCTIONS',
  (id: string, title: string, instructions: string) => ({ id, title, instructions }));

export const dismissOverlay = safeCreateAction('DISMISS_INSTRUCTIONS',
  (id: string) => id);
