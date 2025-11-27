export interface IGithubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
}

export interface IGithubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
}

export type IGithubIssueState = 'open' | 'closed';

export interface IGithubMilestone {
  url: string;
  html_url: string;
  labels_url: string;
  id: number;
  node_id: string;
  number: number;
  state: string;
  title: string;
  description: string;
  creator: IGithubUser;
  closed_issues: number;
  open_issues: number;
  due_on: string;
}

export interface IGithubMilestoneCache {
  number: number;
  state: string;
  title: string;
  closed_issues: number;
  open_issues: number;
  due_on: string;
}

export interface IGithubIssue {
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: IGithubUser;
  labels: IGithubLabel[];
  state: IGithubIssueState;
  locked: boolean;
  assignee: IGithubUser;
  assignees: IGithubUser[];
  milestone: IGithubMilestone;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string;
  author_association: string;
  body: string;
  closed_by: IGithubUser;
}

export interface IGithubComment {
  url: string;
  html_url: string;
  issue_url: string;
  id: number;
  node_id: string;
  user: IGithubUser;
  created_at: string;
  updated_at: string;
  author_association: string;
  body: string;
}

export interface IGithubCommentCache {
  // The comment itself duh
  comment: IGithubComment;

  // Last time that the user responded to the comment
  //  used to decide whether we're going to harass the user
  //  by popping up the issue responder.
  lastCommentResponseMS: number;

  // We want to avoid using up the user's github api calls
  //  this property defines when we're planning on updating
  //  the comment next.
  nextUpdateTimeoutMS: number;
}

export interface IGithubIssueCache {
  number: number;
  title: string;
  state: IGithubIssueState;
  user: string;
  body: string;
  createdTime: number;
  closedTime: number;
  cacheTime: number;
  comments: number;
  labels: string[];
  lastUpdated: number;
  milestone: IGithubMilestoneCache;
  cachedComment: IGithubCommentCache;
}
