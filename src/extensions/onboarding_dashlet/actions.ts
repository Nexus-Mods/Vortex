import safeCreateAction from '../../actions/safeCreateAction';

/**
 * completes a step
 */
export const completeStep = safeCreateAction('COMPLETE_STEP', step => step);
