import { createAction } from 'redux-act';
import { IAnnouncement } from './types';

export const setAnnouncements = createAction('SET_ANNOUNCEMENTS',
    (announcements: IAnnouncement[]) => announcements);
