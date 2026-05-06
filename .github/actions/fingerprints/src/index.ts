import * as core from "@actions/core";
import * as github from "@actions/github";

import { applyToClickHouse } from "./clickhouse";
import { collectFromInput } from "./collect-input";
import { collectFromPR } from "./collect-pr";
import { collectFromRelease } from "./collect-release";
import { CollectResult, MODES, Mode, isMode } from "./types";

/** Routes a validated `mode` to its collector and returns the result. */
const dispatch = async (mode: Mode): Promise<CollectResult> => {
  switch (mode) {
    case Mode.PR:
      return collectFromPR();

    case Mode.Release: {
      const token = core.getInput("github-token", { required: true });
      return collectFromRelease(github.getOctokit(token));
    }

    case Mode.Resolve:
      return collectFromInput();

    default: {
      const exhaustive: never = mode;
      throw new Error(`Unknown mode "${exhaustive}" — must be one of: ${MODES.join(", ")}`);
    }
  }
};

/**
 * Action entry point. Validates the `mode` input, dispatches to the matching
 * collector, and writes the result to ClickHouse. No-ops on empty collection.
 */
const run = async (): Promise<void> => {
  const mode = core.getInput("mode", { required: true });
  if (!isMode(mode)) {
    throw new Error(`Invalid mode "${mode}" — must be one of: ${MODES.join(", ")}`);
  }
  const result = await dispatch(mode);

  if (result.rows.length === 0) {
    core.info("No rows to process.");
    return;
  }

  await applyToClickHouse(result.dbMode, result.rows);
};

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
