import safeCreateAction from './safeCreateAction';

/**
 * set (or unset) notifications to not show again
 */
export const suppressNotification = safeCreateAction('SUPPRESS_NOTIFICATION',
  (id: string, suppress: boolean) => ({ id, suppress }));

export const resetSuppression = safeCreateAction('RESET_SUPPRESSION', () => null);
