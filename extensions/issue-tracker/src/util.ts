import Promise from "bluebird";
import { IncomingMessage } from "http";
import { get } from "https";
import * as url from "url";

import { UPDATE_FREQUENCY } from "./statics";

import {
  IGithubComment,
  IGithubCommentCache,
  IGithubIssue,
  IGithubIssueCache,
} from "./IGithubIssue";

export function isFeedbackRequiredLabel(label: string): boolean {
  return ["help wanted", "waiting for reply"].indexOf(label) !== -1;
}

export function isVortexDev(comment: IGithubComment): boolean {
  // TODO: there must be a better way to distinctly identify a staff member
  //  we could go by organisation, but that would mean having the org set to public
  //  (which I thought we already had, but I guess I was mistaken)
  return ["TanninOne", "IDCs"].indexOf(comment.user.login) !== -1;
}

export function cacheEntry(
  input: IGithubIssue,
  comment: IGithubCommentCache,
): IGithubIssueCache {
  return {
    number: input.number,
    closedTime: Date.parse(input.closed_at),
    createdTime: Date.parse(input.created_at),
    cacheTime: Date.now(),
    comments: input.comments,
    labels: input.labels.map((label) => label.name),
    state: input.state,
    title: input.title,
    body: input.body,
    user: input.user !== undefined ? input.user.login : undefined,
    lastUpdated: Date.parse(input.updated_at),
    milestone:
      input.milestone !== null
        ? {
            number: input.milestone.number,
            title: input.milestone.title,
            state: input.milestone.state,
            closed_issues: input.milestone.closed_issues,
            open_issues: input.milestone.open_issues,
            due_on: input.milestone.due_on,
          }
        : undefined,
    cachedComment: comment,
  };
}

export function getTargetUsers(comment: IGithubComment): string[] {
  const matched: RegExpMatchArray = comment.body.match(/@!([a-zA-Z0-9]+)/gm);
  return matched !== null
    ? matched.map((mat) => mat.substr(2).toLowerCase())
    : [];
}

export function getLastDevComment(
  issue: IGithubIssue,
  cache: IGithubIssueCache,
  nexusUserId: string,
  forced: boolean = false,
): Promise<IGithubCommentCache> {
  const updateFreq = UPDATE_FREQUENCY * 0.5;
  const now = Date.now();
  if (
    !forced &&
    !!cache?.cachedComment &&
    now - cache.cachedComment.nextUpdateTimeoutMS < updateFreq
  ) {
    return Promise.resolve(cache.cachedComment);
  }

  return requestFromApi(issue.comments_url).then(
    (comments: IGithubComment[]) => {
      const relevant = comments.filter(isVortexDev);
      if (relevant.length === 0) {
        return Promise.resolve(undefined);
      }

      const lastComment = relevant.reverse().find((comment) => {
        const userIds = getTargetUsers(comment);
        return (
          userIds.length === 0 || userIds.includes(nexusUserId.toLowerCase())
        );
      });

      if (lastComment === undefined) {
        return Promise.resolve(undefined);
      }

      const lastCommentUpdatedMS = new Date(lastComment.updated_at).getTime();

      // Check if the user has already responded after our last comment
      //  it's possible that the user had responded to our comment before,
      //  but has re-installed Vortex (taking an extra step to erase the state db as well)
      //  in which case Vortex will raise the issue responder again asking him
      //  a question he probably already responded to.
      const reportedByPattern = `Reported by: ${nexusUserId}`.toLowerCase();
      const lastCommentResponseMS = comments.reduce(
        (newestCommentMS, comment) => {
          const createdAtMS = new Date(comment.created_at).getTime();
          if (
            comment.user.login === "VortexFeedback" &&
            comment.body.toLowerCase().indexOf(reportedByPattern) !== -1 &&
            lastCommentUpdatedMS < createdAtMS &&
            newestCommentMS < createdAtMS
          ) {
            // We're looking for all comments created by the vortex feedback system
            //  that include the "reported by [username]" pattern and have been created
            //  _after_ our last developer comment. We're only interested in the highest
            //  value in milliseconds.
            newestCommentMS = createdAtMS;
          }
          return newestCommentMS;
        },
        0,
      );

      const cachedComment: IGithubCommentCache = {
        comment: lastComment,
        lastCommentResponseMS,
        nextUpdateTimeoutMS: now + updateFreq,
      };

      return Promise.resolve(cachedComment);
    },
  );
}

export function requestFromApi(apiURL: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(apiURL);
    } catch (err) {
      return reject(new Error(`Invalid URL: ${apiURL}`));
    }
    get(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { "User-Agent": "Vortex" },
      } as any,
      (res: IncomingMessage) => {
        const { statusCode } = res;
        const contentType = res.headers["content-type"];

        let err: string;
        if (statusCode !== 200) {
          err = `Request Failed. Status Code: ${statusCode}`;
        } else if (!/^application\/json/.test(contentType)) {
          err = `Invalid content-type ${contentType}`;
        }

        if (err !== undefined) {
          res.resume();
          return reject(new Error(err));
        }

        res.setEncoding("utf8");
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            reject(e);
          }
        });
      },
    ).on("error", (err: Error) => {
      return reject(err);
    });
  });
}
