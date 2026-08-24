import { afterAll, describe, expect, it } from "vitest";

import {
  type SummaryParams,
  collectRange,
  extractIssueKeys,
  mergedPullNumber,
  renderSummary,
} from "./summary";
import { commit, gitq, newRepo, removeRepo } from "./test-repo";

const PARAMS: SummaryParams = {
  tag: "v2.6.0-beta.1",
  linearWorkspace: "nexus-mods",
  prevtag: "v2.5.0-beta.2",
  base: "abc123",
  dryRun: false,
  syncOutcome: "success",
  completeOutcome: "success",
  notesAttached: true,
  releaseUrl: "https://linear.app/nexus-mods/release/x",
  repoUrl: "https://github.com/Nexus-Mods/Vortex",
};

describe("extractIssueKeys", () => {
  it("detects keys from branch names in merge subjects", () => {
    expect(extractIssueKeys(["Merge pull request #123 from Nexus-Mods/fix/laz-42"])).toEqual([
      "LAZ-42",
    ]);
  });

  it("keeps the issue key of a cherry-pick wrapper branch but drops the pr-N artifact", () => {
    expect(
      extractIssueKeys([
        "Merge pull request #100 from Nexus-Mods/cherry-pick/pr-99-fix-laz-7-to-master",
      ]),
    ).toEqual(["LAZ-7"]);
  });

  it("surfaces branch-name artifacts as candidate keys (disclaimed in the summary)", () => {
    expect(extractIssueKeys(["Merge branch 'master' into react-18-upgrade"])).toEqual(["REACT-18"]);
  });

  it("de-duplicates and sorts numerically", () => {
    expect(extractIssueKeys(["laz-42 and LAZ-42", "work on laz-7"])).toEqual(["LAZ-7", "LAZ-42"]);
  });
});

describe("mergedPullNumber", () => {
  it("parses a PR merge subject", () => {
    expect(mergedPullNumber("Merge pull request #123 from Nexus-Mods/fix/laz-42")).toBe(123);
  });

  it("rejects branch-sync merges", () => {
    expect(mergedPullNumber("Merge branch 'master' into react-18-upgrade")).toBeUndefined();
  });
});

describe("renderSummary", () => {
  it("marks dry runs", () => {
    expect(renderSummary({ ...PARAMS, dryRun: true })).toContain(
      "## Linear Release — `v2.6.0-beta.1` (dry run, Linear was not modified)",
    );
  });

  it("does not mark real runs as dry", () => {
    const summary = renderSummary(PARAMS);
    expect(summary).toContain("## Linear Release — `v2.6.0-beta.1`");
    expect(summary).not.toContain("dry run");
  });

  it("renders the recap table", () => {
    const summary = renderSummary(PARAMS);
    expect(summary).toContain("| Previous tag (same channel) | v2.5.0-beta.2 |");
    expect(summary).toContain("| Scan base (fork point) | abc123 |");
    expect(summary).toContain("| GitHub release notes | attached |");
    expect(summary).toContain("| Sync issues | success |");
    expect(summary).toContain("| Mark released | success |");
    expect(summary).toContain("| Linear release | https://linear.app/nexus-mods/release/x |");
  });

  it("falls back for missing values", () => {
    const summary = renderSummary({
      ...PARAMS,
      prevtag: "",
      base: "",
      notesAttached: false,
      syncOutcome: "",
      completeOutcome: "",
      releaseUrl: "",
    });
    expect(summary).toContain("| Previous tag (same channel) | _none_ |");
    expect(summary).toContain("| Scan base (fork point) | _CLI default_ |");
    expect(summary).toContain("| GitHub release notes | _none_ |");
    expect(summary).toContain("| Sync issues | _not run_ |");
    expect(summary).toContain("| Mark released | _not run_ |");
    expect(summary).not.toContain("| Linear release |");
  });

  it("skips the commit sections without range data", () => {
    expect(renderSummary(PARAMS)).not.toContain("Issue keys detected");
  });

  it("links issue keys and pull requests", () => {
    const summary = renderSummary(PARAMS, {
      issueKeys: ["LAZ-7", "LAZ-42", "REACT-18"],
      pullRequests: [
        { number: 100, title: "Cherry pick" },
        { number: 123, title: "Fix the thing" },
      ],
    });
    expect(summary).toContain("### Issue keys detected in commits (3)");
    expect(summary).toContain("[LAZ-42](https://linear.app/nexus-mods/issue/LAZ-42)");
    expect(summary).toContain(
      "- [#123](https://github.com/Nexus-Mods/Vortex/pull/123) Fix the thing",
    );
    expect(summary).toContain(
      "- [#100](https://github.com/Nexus-Mods/Vortex/pull/100) Cherry pick",
    );
  });
});

describe("collectRange", () => {
  // A base commit, then two PR merges (one regular, one cherry-pick wrapper)
  // and one branch-sync merge that must not appear in the PR list.
  const repo = newRepo();
  const baseSha = gitq(repo, "rev-parse", "HEAD");

  const merge = (branch: string, subject: string, body: string): void => {
    gitq(repo, "checkout", "-q", "-b", branch);
    commit(repo, `work on ${branch}`);
    gitq(repo, "checkout", "-q", "main");
    gitq(repo, "merge", "-q", "--no-ff", branch, "-m", subject, "-m", body);
  };

  merge("fix/laz-42", "Merge pull request #123 from Nexus-Mods/fix/laz-42", "Fix the thing");
  merge(
    "cherry-pick/pr-99-fix-laz-7-to-master",
    "Merge pull request #100 from Nexus-Mods/cherry-pick/pr-99-fix-laz-7-to-master",
    "Cherry pick",
  );
  merge("sync/master", "Merge branch 'master' into react-18-upgrade", "sync");
  gitq(repo, "tag", "v2.6.0-beta.1");

  afterAll(() => {
    removeRepo(repo);
  });

  it("collects issue keys and merged PRs, newest first, skipping branch-sync merges", async () => {
    const range = await collectRange(baseSha, "v2.6.0-beta.1", repo);
    expect(range.issueKeys).toEqual(["LAZ-7", "LAZ-42", "REACT-18"]);
    expect(range.pullRequests).toEqual([
      { number: 100, title: "Cherry pick" },
      { number: 123, title: "Fix the thing" },
    ]);
  });
});
