import * as core from "@actions/core";
import * as github from "@actions/github";

import { commitBodyFirstLine, commitSubject, logMergeShas, logSubjects } from "./git";

export interface SummaryParams {
  tag: string;
  linearWorkspace: string;
  prevtag: string;
  base: string;
  dryRun: boolean;
  syncOutcome: string;
  completeOutcome: string;
  notesAttached: boolean;
  releaseUrl: string;
  repoUrl: string;
}

export interface MergedPullRequest {
  number: number;
  title: string;
}

export interface RangeData {
  issueKeys: string[];
  pullRequests: MergedPullRequest[];
}

/**
 * Issue-key candidates from commit subjects, uppercased, de-duplicated and
 * sorted. `PR-<n>` matches are cherry-pick branch artifacts, not issues.
 */
export const extractIssueKeys = (subjects: readonly string[]): string[] => {
  const keys = new Set<string>();
  for (const subject of subjects) {
    for (const match of subject.matchAll(/\b[a-z]{2,}-\d+\b/giu)) {
      const key = match[0].toUpperCase();
      if (!key.startsWith("PR-")) {
        keys.add(key);
      }
    }
  }
  return [...keys].toSorted((a, b) => a.localeCompare(b, "en", { numeric: true }));
};

/** The PR number of a `Merge pull request #N ...` subject, if it is one. */
export const mergedPullNumber = (subject: string): number | undefined => {
  const match = /^Merge pull request #(\d+)\b/u.exec(subject);
  const num = match?.[1];
  return num === undefined ? undefined : Number(num);
};

/**
 * Renders the markdown recap. `range` is absent when there is no scan base,
 * in which case the commit sections are skipped.
 */
export const renderSummary = (params: SummaryParams, range?: RangeData): string => {
  const lines: string[] = [
    params.dryRun
      ? `## Linear Release — \`${params.tag}\` (dry run, Linear was not modified)`
      : `## Linear Release — \`${params.tag}\``,
    "",
    "| | |",
    "| --- | --- |",
    `| Previous tag (same channel) | ${params.prevtag || "_none_"} |`,
    `| Scan base (fork point) | ${params.base || "_CLI default_"} |`,
    `| GitHub release notes | ${params.notesAttached ? "attached" : "_none_"} |`,
    `| Sync issues | ${params.syncOutcome || "_not run_"} |`,
    `| Mark released | ${params.completeOutcome || "_not run_"} |`,
  ];
  if (params.releaseUrl !== "") {
    lines.push(`| Linear release | ${params.releaseUrl} |`);
  }
  lines.push("");
  if (range === undefined) {
    return lines.join("\n");
  }

  lines.push(
    `### Issue keys detected in commits (${range.issueKeys.length})`,
    "",
    range.issueKeys
      .map((key) => `[${key}](https://linear.app/${params.linearWorkspace}/issue/${key})`)
      .join(" "),
    "",
    "_Candidates from the branch/subject scan — some are branch-name artifacts whose links lead nowhere. Linear ignores keys that don't exist and also attaches issues linked to the pull requests below; the release page in Linear is the authoritative list._",
    "",
    "### Pull requests in range",
    "",
  );
  for (const pr of range.pullRequests) {
    lines.push(`- [#${pr.number}](${params.repoUrl}/pull/${pr.number}) ${pr.title}`);
  }
  lines.push("");
  return lines.join("\n");
};

/**
 * Gathers issue-key candidates and merged PRs for the `base..tag` range. The
 * keys mirror the release CLI's client-side commit scan; Linear resolves PR
 * links server-side on top of these, so the release page in Linear is the
 * authoritative list.
 */
export const collectRange = async (base: string, tag: string, cwd?: string): Promise<RangeData> => {
  const range = `${base}..refs/tags/${tag}`;
  const issueKeys = extractIssueKeys(await logSubjects(range, cwd));
  const pullRequests: MergedPullRequest[] = [];
  for (const sha of await logMergeShas(range, cwd)) {
    const subject = await commitSubject(sha, cwd);
    const number = mergedPullNumber(subject);
    if (number === undefined) {
      continue;
    }
    const title = (await commitBodyFirstLine(sha, cwd)) || subject;
    pullRequests.push({ number, title });
  }
  return { issueKeys, pullRequests };
};

/** Entry point for mode=summary: reads inputs and writes the run summary. */
export const runSummary = async (): Promise<void> => {
  const params: SummaryParams = {
    tag: core.getInput("tag", { required: true }),
    linearWorkspace: core.getInput("linear-workspace", { required: true }),
    prevtag: core.getInput("prevtag"),
    base: core.getInput("base"),
    dryRun: core.getInput("dry-run") === "true",
    syncOutcome: core.getInput("sync-outcome"),
    completeOutcome: core.getInput("complete-outcome"),
    notesAttached: core.getInput("notes-file") !== "",
    releaseUrl: core.getInput("release-url"),
    repoUrl: `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}`,
  };
  const range = params.base === "" ? undefined : await collectRange(params.base, params.tag);
  core.summary.addRaw(renderSummary(params, range), true);
  await core.summary.write();
};
