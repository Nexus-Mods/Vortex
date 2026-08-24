import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Minimal surface of the Octokit client used to fetch release notes. */
export interface ReleaseClient {
  rest: {
    repos: {
      getReleaseByTag(params: {
        owner: string;
        repo: string;
        tag: string;
      }): Promise<{ data: { body?: string | null } }>;
    };
  };
}

/**
 * The GitHub release notes body for `tag`, or the empty string when the
 * release does not exist or has no body. Fetched from the API rather than
 * the event payload so workflow_dispatch runs pick up the notes too.
 */
export const fetchReleaseNotes = async (
  client: ReleaseClient,
  owner: string,
  repo: string,
  tag: string,
): Promise<string> => {
  try {
    const { data } = await client.rest.repos.getReleaseByTag({ owner, repo, tag });
    return data.body ?? "";
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "status" in err && err.status === 404) {
      return "";
    }
    throw err;
  }
};

/** Writes `notes` to a file the release action can attach; returns its path. */
export const writeNotesFile = (notes: string): string => {
  const file = join(process.env["RUNNER_TEMP"] ?? tmpdir(), "release-notes.md");
  writeFileSync(file, notes);
  return file;
};
