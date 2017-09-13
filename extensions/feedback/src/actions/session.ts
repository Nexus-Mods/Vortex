import { IFeedbackFile } from '../types/IFeedbackFile';

import { createAction } from 'redux-act';

export const addFeedbackFile = createAction('ADD_FEEDBACK_FILE',
  (feedbackFile: IFeedbackFile) => ({ feedbackFile }));

export const removeFeedbackFile = createAction('REMOVE_FEEDBACK_FILE',
  (feedbackFileId: string) => ({ feedbackFileId }));

export const clearFeedbackFiles = createAction('CLEAR_FEEDBACK_FILES');
