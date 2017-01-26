import createAction from '../../../actions/safeCreateAction';

export const startDialog = createAction('START_FOMOD_DIALOG');

export const endDialog = createAction('END_FOMOD_DIALOG');

export const setDialogState = createAction('SET_FOMOD_DIALOG_STATE');
