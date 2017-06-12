import { IFeedbackFile } from '../types/IFeedbackFile';

import { safeCreateAction } from 'nmm-api';

export const addFeedbackFile = safeCreateAction('ADD_FEEDBACK_FILE',
  (feedbackFile: IFeedbackFile) => ({ feedbackFile }));

export const removeFeedbackFile = safeCreateAction('REMOVE_FEEDBACK_FILE',
  (feedbackFileId: string) => ({ feedbackFileId }));

export const clearFeedbackFiles = safeCreateAction('CLEAR_FEEDBACK_FILES');
