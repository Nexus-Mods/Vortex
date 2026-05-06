import * as core from "@actions/core";
import * as github from "@actions/github";

import { CollectResult, PR_FINGERPRINT_RE, Status } from "./types";

/**
 * Collects fingerprints referenced by `Fixes fingerprint XXXXXXXX` lines in
 * the current `pull_request` event's body and returns them as `fixed`-status
 * rows. Throws if invoked outside a `pull_request` event.
 */
export const collectFromPR = (): CollectResult => {
  const pr = github.context.payload.pull_request;
  if (!pr) {
    throw new Error("No pull_request payload available; mode=pr requires a pull_request event.");
  }

  const body: string = pr.body ?? "";
  const fingerprints = [
    ...new Set(
      [...body.matchAll(PR_FINGERPRINT_RE)].flatMap((m) =>
        m[1]
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((fp) => fp.toLowerCase()),
      ),
    ),
  ];

  const rows = fingerprints.map((fingerprint) => ({
    fingerprint,
    pr_url: pr.html_url as string,
    updated_by: pr.user.login as string,
    release_version: "",
    status: Status.Fixed,
  }));

  core.info(`Collected ${rows.length} fingerprint row(s) from PR body.`);
  return { rows, dbMode: "insert" };
};
