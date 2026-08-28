import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { type ReleaseClient, fetchReleaseNotes, writeNotesFile } from "./notes";

const clientWith = (
  getReleaseByTag: ReleaseClient["rest"]["repos"]["getReleaseByTag"],
): ReleaseClient => ({ rest: { repos: { getReleaseByTag } } });

describe("fetchReleaseNotes", () => {
  it("returns the release body", async () => {
    const client = clientWith(() => Promise.resolve({ data: { body: "notes" } }));
    await expect(fetchReleaseNotes(client, "o", "r", "v1.0.0")).resolves.toBe("notes");
  });

  it("returns empty for a missing release", async () => {
    const client = clientWith(() =>
      Promise.reject(Object.assign(new Error("Not Found"), { status: 404 })),
    );
    await expect(fetchReleaseNotes(client, "o", "r", "v1.0.0")).resolves.toBe("");
  });

  it("returns empty for a release without a body", async () => {
    const client = clientWith(() => Promise.resolve({ data: { body: null } }));
    await expect(fetchReleaseNotes(client, "o", "r", "v1.0.0")).resolves.toBe("");
  });

  it("rethrows other errors", async () => {
    const client = clientWith(() =>
      Promise.reject(Object.assign(new Error("Server Error"), { status: 500 })),
    );
    await expect(fetchReleaseNotes(client, "o", "r", "v1.0.0")).rejects.toThrow("Server Error");
  });
});

describe("writeNotesFile", () => {
  const previousRunnerTemp = process.env["RUNNER_TEMP"];
  const dir = mkdtempSync(join(tmpdir(), "linear-release-notes-"));

  afterEach(() => {
    process.env["RUNNER_TEMP"] = previousRunnerTemp;
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes the notes to RUNNER_TEMP and returns the path", () => {
    process.env["RUNNER_TEMP"] = dir;
    const file = writeNotesFile("release notes body");
    expect(file).toBe(join(dir, "release-notes.md"));
    expect(readFileSync(file, "utf8")).toBe("release notes body");
  });
});
