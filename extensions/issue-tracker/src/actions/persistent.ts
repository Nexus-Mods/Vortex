import { createAction } from "redux-act";

import type { IGithubIssueCache } from "../IGithubIssue";

export const updateIssueList = createAction("UPDATE_ISSUE_LIST", (issueIds: string[]) => issueIds);

export const setUpdateDetails = createAction(
  "SET_UPDATE_DETAILS",
  (issueId: string, details: IGithubIssueCache) => ({ issueId, details }),
);
