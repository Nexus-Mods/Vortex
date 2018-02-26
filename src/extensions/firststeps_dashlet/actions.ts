import safeCreateAction from '../../actions/safeCreateAction';

/**
 * dismiss a todo message from the "first steps" list
 */
export const dismissStep = safeCreateAction('DISMISS_STEP', step => step);
