import { createAction } from 'redux-act';
import { IOutstandingIssue } from '../types';

export const openFeedbackResponder = createAction('OPEN_FEEDBACK_RESPONDER',
    (open: boolean) => open);

// Issues that require a response from the user.
export const setOutstandingIssues = createAction('SET_OUTSTANDING_ISSUES',
    (issues: IOutstandingIssue[]) => issues);
