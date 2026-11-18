import { IGithubComment, IGithubIssue, IGithubIssueCache } from "./IGithubIssue";

export interface IOutstandingIssue {
  issue: IGithubIssue;
  lastDevComment: IGithubComment;
}

/** `persistent.issues` */
export interface IIssuesPersistentState {
  /** cached issue details, by issue id; a newly listed issue starts out as an empty object */
  issues: { [issueId: string]: IGithubIssueCache };
}

/** `session.issues` */
export interface IIssuesSessionState {
  feedbackResponderOpen: boolean;
  /** (sic) the key is misspelled in the stored state */
  oustandingIssues: IOutstandingIssue[] | null;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface IPersistentState {
      issues: IIssuesPersistentState;
    }
    interface ISessionState {
      issues: IIssuesSessionState;
    }
  }
}
