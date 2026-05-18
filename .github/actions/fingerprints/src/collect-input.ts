import * as core from "@actions/core";
import * as github from "@actions/github";

import { CollectResult, FINGERPRINT_RE, STATUSES, isStatus } from "./types";

/**
 * Validates manually-supplied `workflow_dispatch` inputs and produces either
 * insert rows (with the chosen status) or a delete batch, depending on the
 * `remove` flag. Throws on malformed fingerprints or missing release version.
 */
export const collectFromInput = (): CollectResult => {
  const ctx = github.context;
  const fingerprintsInput = core.getInput("fingerprints", { required: true });
  const remove = core.getBooleanInput("remove");
  const rawStatus = core.getInput("status");
  if (!isStatus(rawStatus)) {
    throw new Error(`Invalid status "${rawStatus}" — must be one of: ${STATUSES.join(", ")}`);
  }
  const status = rawStatus;
  const releaseVersion = core.getInput("release-version");

  const fingerprints = [
    ...new Set(
      fingerprintsInput
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((fp) => fp.toLowerCase()),
    ),
  ];

  if (fingerprints.length === 0) {
    throw new Error("No fingerprints provided.");
  }

  const invalid = fingerprints.filter((fp) => !FINGERPRINT_RE.test(fp));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid fingerprint(s) (must be 8 lowercase hex chars): ${invalid.join(", ")}`,
    );
  }

  if (!remove && status === "released" && !releaseVersion) {
    throw new Error('release-version is required when status is "released".');
  }

  const dbMode = remove ? "delete" : "insert";
  const runUrl = `${ctx.serverUrl}/${ctx.repo.owner}/${ctx.repo.repo}/actions/runs/${ctx.runId}`;

  core.info(
    `${remove ? "Removing" : `Adding (${status})`} ${fingerprints.length} fingerprint(s) by ${ctx.actor}: ${fingerprints.join(", ")}`,
  );

  const rows = fingerprints.map((fingerprint) => ({
    fingerprint,
    pr_url: runUrl,
    updated_by: ctx.actor,
    release_version: releaseVersion,
    status,
  }));

  return { rows, dbMode };
};
