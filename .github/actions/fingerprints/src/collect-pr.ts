import * as core from "@actions/core";
import * as github from "@actions/github";

import { type CollectResult, PR_FINGERPRINT_RE, Status } from "./types";

type Octokit = ReturnType<typeof github.getOctokit>;

/** The pull request fields the collector reads, shared by the event payload and the REST shape. */
export interface PullRequestLike {
  body?: string | null;
  html_url?: string;
  user?: { login?: unknown } | null;
}

/** Fetches a merged pull request by number for dispatched runs without a `pull_request` payload. */
export const fetchPullRequest = async (
  octokit: Octokit,
  number: number,
): Promise<PullRequestLike> => {
  const { data } = await octokit.rest.pulls.get({ ...github.context.repo, pull_number: number });
  if (data.merged_at === null) {
    throw new Error(`Pull request #${number} is not merged.`);
  }
  return data;
};

/**
 * Collects fingerprints referenced by `Fixes fingerprint XXXXXXXX` lines in
 * the pull request's body and returns them as `fixed`-status rows. Defaults to
 * the current `pull_request` event; throws if there is none and no `pr` given.
 */
export const collectFromPR = (
  pr: PullRequestLike | undefined = github.context.payload.pull_request,
): CollectResult => {
  if (!pr) {
    throw new Error("No pull_request payload available; mode=pr requires a pull_request event.");
  }

  const body: string = pr.body ?? "";
  const fingerprints = [
    ...new Set(
      [...body.matchAll(PR_FINGERPRINT_RE)].flatMap((m) =>
        (m[1] ?? "")
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((fp) => fp.toLowerCase()),
      ),
    ),
  ];

  // `user` is untyped in the webhook payload, unlike `html_url`.
  const login: unknown = pr.user?.login;

  const rows = fingerprints.map((fingerprint) => ({
    fingerprint,
    pr_url: pr.html_url ?? "",
    updated_by: typeof login === "string" ? login : "",
    release_version: "",
    status: Status.Fixed,
  }));

  core.info(`Collected ${rows.length} fingerprint row(s) from PR body.`);
  return { rows, dbMode: "insert" };
};
