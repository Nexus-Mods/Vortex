import fs from "node:fs";
import path from "node:path";

import type { NexusUser } from "./users";

/**
 * Directory holding captured Nexus website session storage-state files.
 *
 * Populated by `pnpm -F @vortex/e2e auth:capture` (a one-time headed login where
 * you solve the captcha by hand) and consumed by the auth-snapshot fixture to
 * skip the captcha-gated credential login on local runs. Gitignored — the files
 * contain live session cookies and must never be committed. Absent on CI, so the
 * fixture falls back to the full OAuth credential flow there.
 */
export const AUTH_DIR = path.resolve(import.meta.dirname, "..", "..", ".auth");

/** Path to the captured storage-state file for a user, keyed by username. */
export function authStatePath(user: NexusUser): string {
  const safe = user.username.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(AUTH_DIR, `${safe}.json`);
}

/**
 * A user's captured storage-state path if `pnpm auth:capture` has been run,
 * else undefined. Pass to loginToNexus: with it the OAuth flow lands on the
 * consent screen and skips the captcha; without it (CI) the full flow runs.
 */
export function seededAuthStatePath(user: NexusUser): string | undefined {
  const captured = authStatePath(user);
  return fs.existsSync(captured) ? captured : undefined;
}
