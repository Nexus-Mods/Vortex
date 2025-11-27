import { IGithubComment, IGithubIssue } from './IGithubIssue';

export interface IOutstandingIssue {
  issue: IGithubIssue;
  lastDevComment: IGithubComment;
}
