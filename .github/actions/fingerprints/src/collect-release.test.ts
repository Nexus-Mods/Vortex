import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  payload: {},
  repo: { owner: "org", repo: "repo" },
  ref: "refs/tags/v1.2.0",
}));

vi.mock("@actions/core", () => ({ info: vi.fn() }));
vi.mock("@actions/github", () => ({ context: ctx, getOctokit: vi.fn() }));

const { collectFromRelease } = await import("./collect-release");

interface FakePR {
  body: string | null;
  html_url: string;
  user: { login: string } | null;
  updated_at: string;
  merged_at: string | null;
  head: { ref: string };
}

const makePR = (overrides: Partial<FakePR> = {}): FakePR => ({
  body: "",
  html_url: "https://github.com/x/y/pull/1",
  user: { login: "alice" },
  updated_at: "2024-06-01T00:00:00Z",
  merged_at: "2024-06-01T00:00:00Z",
  head: { ref: "feature-branch" },
  ...overrides,
});

interface FakeOctokitOpts {
  tags?: Array<{ name: string }>;
  prPages?: FakePR[][];
  refType?: "commit" | "tag";
  refSha?: string;
  tagObjectSha?: string;
  commitDate?: string;
}

const makeOctokit = ({
  tags = [{ name: "v1.2.0" }, { name: "v1.1.0" }],
  prPages = [[]],
  refType = "commit",
  refSha = "sha-prev",
  tagObjectSha = "sha-tag-target",
  commitDate = "2024-05-01T00:00:00Z",
}: FakeOctokitOpts = {}) => {
  const paginate = vi.fn().mockResolvedValue(tags) as ReturnType<typeof vi.fn> & {
    iterator: ReturnType<typeof vi.fn>;
  };
  paginate.iterator = vi.fn().mockReturnValue({
    async *[Symbol.asyncIterator]() {
      for (const page of prPages) yield { data: page };
    },
  });

  return {
    rest: {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { type: refType, sha: refSha } },
        }),
        getTag: vi.fn().mockResolvedValue({
          data: { object: { sha: tagObjectSha } },
        }),
        getCommit: vi.fn().mockResolvedValue({
          data: { author: { date: commitDate } },
        }),
      },
      repos: { listTags: "listTags-method" },
      pulls: { list: "pulls-list-method" },
    },
    paginate,
  };
};

describe("collectFromRelease", () => {
  beforeEach(() => {
    ctx.ref = "refs/tags/v1.2.0";
  });

  it("returns empty rows when there is no previous tag", async () => {
    const octokit = makeOctokit({ tags: [{ name: "v1.2.0" }] });
    const result = await collectFromRelease(octokit as never);
    expect(result.rows).toEqual([]);
    expect(result.dbMode).toBe("insert");
  });

  it("throws when current tag is not in the tag list", async () => {
    const octokit = makeOctokit({ tags: [{ name: "v1.0.0" }] });
    await expect(collectFromRelease(octokit as never)).rejects.toThrow(/not found/);
  });

  it("collects fingerprints from PRs merged after the previous tag", async () => {
    const octokit = makeOctokit({
      commitDate: "2024-05-01T00:00:00Z",
      prPages: [
        [
          makePR({
            body: "Fixes fingerprint a1b2c3d4",
            updated_at: "2024-06-01T00:00:00Z",
            merged_at: "2024-06-01T00:00:00Z",
          }),
        ],
      ],
    });
    const result = await collectFromRelease(octokit as never);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      fingerprint: "a1b2c3d4",
      release_version: "v1.2.0",
      status: "released",
      updated_by: "alice",
    });
  });

  it("skips PRs whose merged_at is before the previous tag", async () => {
    const octokit = makeOctokit({
      commitDate: "2024-05-01T00:00:00Z",
      prPages: [
        [
          makePR({
            body: "Fixes fingerprint a1b2c3d4",
            updated_at: "2024-06-01T00:00:00Z",
            merged_at: "2024-04-01T00:00:00Z",
          }),
        ],
      ],
    });
    const result = await collectFromRelease(octokit as never);
    expect(result.rows).toEqual([]);
  });

  it("skips closed-but-not-merged PRs", async () => {
    const octokit = makeOctokit({
      commitDate: "2024-05-01T00:00:00Z",
      prPages: [
        [
          makePR({
            body: "Fixes fingerprint a1b2c3d4",
            updated_at: "2024-06-01T00:00:00Z",
            merged_at: null,
          }),
        ],
      ],
    });
    const result = await collectFromRelease(octokit as never);
    expect(result.rows).toEqual([]);
  });

  it("dedupes the same fingerprint when referenced by multiple PRs", async () => {
    const octokit = makeOctokit({
      commitDate: "2024-05-01T00:00:00Z",
      prPages: [
        [
          makePR({
            body: "Fixes fingerprint a1b2c3d4",
            updated_at: "2024-06-02T00:00:00Z",
            merged_at: "2024-06-02T00:00:00Z",
          }),
          makePR({
            body: "Fixes fingerprint a1b2c3d4",
            updated_at: "2024-06-01T00:00:00Z",
            merged_at: "2024-06-01T00:00:00Z",
          }),
        ],
      ],
    });
    const result = await collectFromRelease(octokit as never);
    expect(result.rows).toHaveLength(1);
  });

  it("stops paginating once a PR's updated_at is before since", async () => {
    const octokit = makeOctokit({
      commitDate: "2024-05-01T00:00:00Z",
      prPages: [
        [
          makePR({
            body: "Fixes fingerprint aaaaaaaa",
            updated_at: "2024-06-01T00:00:00Z",
            merged_at: "2024-06-01T00:00:00Z",
          }),
          makePR({
            body: "Fixes fingerprint bbbbbbbb",
            updated_at: "2024-04-01T00:00:00Z",
            merged_at: "2024-04-01T00:00:00Z",
          }),
        ],
        [
          makePR({
            body: "Fixes fingerprint cccccccc",
            updated_at: "2024-03-01T00:00:00Z",
            merged_at: "2024-03-01T00:00:00Z",
          }),
        ],
      ],
    });
    const result = await collectFromRelease(octokit as never);
    expect(result.rows.map((r) => r.fingerprint)).toEqual(["aaaaaaaa"]);
  });

  it("dereferences annotated tags through the tag object", async () => {
    const octokit = makeOctokit({
      refType: "tag",
      refSha: "tag-object-sha",
      tagObjectSha: "real-commit-sha",
    });
    await collectFromRelease(octokit as never);
    expect(octokit.rest.git.getTag).toHaveBeenCalledWith(
      expect.objectContaining({ tag_sha: "tag-object-sha" }),
    );
    expect(octokit.rest.git.getCommit).toHaveBeenCalledWith(
      expect.objectContaining({ commit_sha: "real-commit-sha" }),
    );
  });

  it("skips cherry-pick PRs even if their body contains a fingerprint", async () => {
    const octokit = makeOctokit({
      commitDate: "2024-05-01T00:00:00Z",
      prPages: [
        [
          makePR({
            body: "Fixes fingerprint a1b2c3d4",
            head: { ref: "cherry-pick/pr-123-to-master" },
          }),
          makePR({
            body: "Fixes fingerprint b5c6d7e8",
            head: { ref: "feature/real-fix" },
          }),
        ],
      ],
    });
    const result = await collectFromRelease(octokit as never);
    expect(result.rows.map((r) => r.fingerprint)).toEqual(["b5c6d7e8"]);
  });

  it("uses lightweight tags directly without calling getTag", async () => {
    const octokit = makeOctokit({
      refType: "commit",
      refSha: "direct-commit-sha",
    });
    await collectFromRelease(octokit as never);
    expect(octokit.rest.git.getTag).not.toHaveBeenCalled();
    expect(octokit.rest.git.getCommit).toHaveBeenCalledWith(
      expect.objectContaining({ commit_sha: "direct-commit-sha" }),
    );
  });
});
