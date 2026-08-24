import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Test-only helpers for building throwaway git repositories. Not imported by
// index.ts, so none of this reaches the bundle.

const GIT_IDENTITY = [
  "-c",
  "user.name=test",
  "-c",
  "user.email=test@test.invalid",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "tag.gpgSign=false",
];

/** Runs git in `cwd` with a fixed identity and signing disabled. */
export const gitq = (cwd: string, ...args: string[]): string =>
  execFileSync("git", [...GIT_IDENTITY, ...args], { cwd, encoding: "utf8" }).trim();

/** Creates a temp repository with a single root commit. */
export const newRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "linear-release-test-"));
  gitq(dir, "init", "-q", "-b", "main");
  commit(dir, "root");
  return dir;
};

/** Adds an empty commit. */
export const commit = (cwd: string, message: string): void => {
  gitq(cwd, "commit", "-q", "--allow-empty", "-m", message);
};

/** Removes a repository created by `newRepo`. */
export const removeRepo = (dir: string): void => {
  rmSync(dir, { recursive: true, force: true });
};
