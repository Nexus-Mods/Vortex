import safeCreateAction from '../../actions/safeCreateAction';

/**
 * dismiss a todo message from the "first steps" list
 */
export const dismissStep: any = safeCreateAction('DISMISS_STEP');
