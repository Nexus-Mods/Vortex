import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Runs git with the given args and returns stdout without trailing newlines. */
export const git = async (args: readonly string[], cwd?: string): Promise<string> => {
  const { stdout } = await execFileAsync("git", [...args], { cwd });
  return stdout.replace(/(?:\r?\n)+$/u, "");
};

/** Whether `tag` exists in the repository. */
export const tagExists = async (tag: string, cwd?: string): Promise<boolean> => {
  try {
    await git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], cwd);
    return true;
  } catch {
    return false;
  }
};

/** All tags starting with `v`. */
export const listVersionTags = async (cwd?: string): Promise<string[]> =>
  (await git(["tag", "--list", "v*"], cwd)).split(/\r?\n/u).filter((line) => line.length > 0);

/** The merge-base commit of two tags. */
export const mergeBase = async (a: string, b: string, cwd?: string): Promise<string> =>
  git(["merge-base", `refs/tags/${a}`, `refs/tags/${b}`], cwd);

/** Commit subjects in `range`, newest first. */
export const logSubjects = async (range: string, cwd?: string): Promise<string[]> =>
  (await git(["log", range, "--format=%s"], cwd)).split(/\r?\n/u).filter((line) => line.length > 0);

/** SHAs of merge commits in `range`, newest first. */
export const logMergeShas = async (range: string, cwd?: string): Promise<string[]> =>
  (await git(["log", range, "--merges", "--format=%H"], cwd))
    .split(/\r?\n/u)
    .filter((line) => line.length > 0);

/** Subject (first line) of a commit. */
export const commitSubject = async (sha: string, cwd?: string): Promise<string> =>
  git(["show", "-s", "--format=%s", sha], cwd);

/** First line of a commit's body, empty when the body is. */
export const commitBodyFirstLine = async (sha: string, cwd?: string): Promise<string> => {
  const body = await git(["show", "-s", "--format=%b", sha], cwd);
  return body.split(/\r?\n/u)[0] ?? "";
};
