import * as core from "@actions/core";
import * as github from "@actions/github";

import { runPrepare } from "./prepare";
import { runSummary } from "./summary";

/** Action entry point. Routes the `mode` input to its command. */
const run = async (): Promise<void> => {
  const mode = core.getInput("mode", { required: true });
  switch (mode) {
    case "prepare": {
      const token = core.getInput("github-token", { required: true });
      await runPrepare(
        github.getOctokit(token),
        github.context.repo.owner,
        github.context.repo.repo,
      );
      return;
    }
    case "summary":
      await runSummary();
      return;
    default:
      throw new Error(`Invalid mode "${mode}" — must be "prepare" or "summary"`);
  }
};

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
