import * as core from "@actions/core";
import * as github from "@actions/github";

import { CollectResult, FingerprintRow, PR_FINGERPRINT_RE, Status } from "./types";

type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * Resolves the commit SHA pointed at by a tag ref. Annotated tags point at
 * a tag object that itself points at the commit; lightweight tags point at
 * the commit directly. Both cases are normalized to the commit SHA.
 */
const resolvePreviousTagCommitSha = async (
  octokit: Octokit,
  ctx: typeof github.context,
  previousTag: string,
): Promise<string> => {
  const { data: ref } = await octokit.rest.git.getRef({
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    ref: `tags/${previousTag}`,
  });

  if (ref.object.type === "tag") {
    const { data: tag } = await octokit.rest.git.getTag({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      tag_sha: ref.object.sha,
    });
    return tag.object.sha;
  }
  return ref.object.sha;
};

/**
 * Walks merged PRs in `updated_at desc` order and returns fingerprint rows
 * for every PR merged on or after `sinceDate`. Stops as soon as a PR with
 * `updated_at < sinceDate` is reached — `merged_at <= updated_at` guarantees
 * no later page can contain anything still relevant.
 */
const collectFingerprintRowsSince = async (
  octokit: Octokit,
  ctx: typeof github.context,
  sinceDate: Date,
  version: string,
): Promise<{ rows: FingerprintRow[]; mergedCount: number }> => {
  const seen = new Set<string>();
  const rows: FingerprintRow[] = [];
  let mergedCount = 0;

  for await (const { data } of octokit.paginate.iterator(octokit.rest.pulls.list, {
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: 100,
  })) {
    for (const pr of data) {
      if (new Date(pr.updated_at) < sinceDate) {
        return { rows, mergedCount };
      }
      if (!pr.merged_at || new Date(pr.merged_at) < sinceDate) continue;
      // Auto-cherry-pick PRs always have head branches like
      // `cherry-pick/pr-N-to-TARGET` (see .github/scripts/cherry-pick.sh).
      // Skip them — the original PR is what fixes the fingerprint.
      if (pr.head.ref.startsWith("cherry-pick/")) continue;
      mergedCount++;

      const body = pr.body ?? "";
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
      for (const fingerprint of fingerprints) {
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        rows.push({
          fingerprint,
          pr_url: pr.html_url,
          updated_by: pr.user?.login ?? "",
          release_version: version,
          status: Status.Released,
        });
      }
    }
  }
  return { rows, mergedCount };
};

/**
 * Should be triggered when we have a new Vorted release (push to a `v*` tag).
 * Walks merged PRs since the previous release, collects referenced fingerprints,
 * and marks them as released in the database.
 */
export const collectFromRelease = async (octokit: Octokit): Promise<CollectResult> => {
  const ctx = github.context;
  const version = ctx.ref.replace("refs/tags/", "");

  const tags = await octokit.paginate(octokit.rest.repos.listTags, {
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    per_page: 100,
  });

  const tagNames = tags.map((t) => t.name).filter((n) => n.startsWith("v"));
  const currentIndex = tagNames.indexOf(version);
  if (currentIndex < 0) {
    throw new Error(`Current tag ${version} not found in repository tag list.`);
  }
  const previousTag = tagNames[currentIndex + 1];
  if (!previousTag) {
    core.info("No previous tag found, nothing to mark as released.");
    return { rows: [], dbMode: "insert" };
  }

  const previousCommitSha = await resolvePreviousTagCommitSha(octokit, ctx, previousTag);
  const { data: previousCommit } = await octokit.rest.git.getCommit({
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    commit_sha: previousCommitSha,
  });

  const since = previousCommit.author.date;
  const sinceDate = new Date(since);
  core.info(`Processing PRs merged since ${previousTag} (${since})`);

  const { rows, mergedCount } = await collectFingerprintRowsSince(octokit, ctx, sinceDate, version);

  core.info(`Found ${mergedCount} merged PR(s), ${rows.length} unique fingerprint(s).`);
  return { rows, dbMode: "insert" };
};
