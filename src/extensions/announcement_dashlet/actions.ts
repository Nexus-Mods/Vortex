import { createAction } from 'redux-act';
import { IAnnouncement, ISurveyInstance } from './types';

export const setAnnouncements = createAction('SET_ANNOUNCEMENTS',
    (announcements: IAnnouncement[]) => announcements);

export const setAvailableSurveys = createAction('SET_AVAILABLE_SURVEYS',
  (surveys: ISurveyInstance[]) => surveys);

export const setSuppressSurvey = createAction('SET_SUPPRESS_SURVEY',
  (id: string, suppress: boolean) => ({ id, suppress }));
