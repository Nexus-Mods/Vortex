import { createAction } from 'redux-act';

export const updateIssueList = createAction('UPDATE_ISSUE_LIST',
    (issueIds: string[]) => issueIds);

export const setUpdateDetails = createAction('SET_UPDATE_DETAILS',
    (issueId: string, details: any) => ({ issueId, details }));
