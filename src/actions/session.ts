import safeCreateAction from './safeCreateAction';

/**
 * action to choose which item in a group to display (all other items in the
 * group will be hidden). the itemId can be undefined to hide them all.
 */
export const displayGroup = safeCreateAction('DISPLAY_GROUP',
  (groupId: string, itemId?: string) => ({ groupId, itemId }));
