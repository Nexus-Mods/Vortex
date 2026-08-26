import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { type ReleaseClient } from "./notes";
import { runPrepare } from "./prepare";
import { commit, gitq, newRepo, removeRepo } from "./test-repo";

// core.setOutput writes either `name=value` lines or `name<<delimiter` heredocs.
const parseOutputs = (content: string): Record<string, string> => {
  const outputs: Record<string, string> = {};
  const lines = content.split(/\r?\n/u);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const heredoc = /^(.+?)<<(.+)$/u.exec(line);
    if (heredoc !== null) {
      const name = heredoc[1] ?? "";
      const delimiter = heredoc[2] ?? "";
      const value: string[] = [];
      for (i++; i < lines.length && lines[i] !== delimiter; i++) {
        value.push(lines[i] ?? "");
      }
      outputs[name] = value.join("\n");
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0) {
      outputs[line.slice(0, eq)] = line.slice(eq + 1);
    }
  }
  return outputs;
};

const clientWith = (body: string | null): ReleaseClient => ({
  rest: {
    repos: {
      getReleaseByTag:
        body === null
          ? () => Promise.reject(Object.assign(new Error("Not Found"), { status: 404 }))
          : () => Promise.resolve({ data: { body } }),
    },
  },
});

describe("runPrepare", () => {
  // main:  root -- fork -- m1 -- m2 -- (rel26) f1 [v2.6.0-beta.1] -- f2 [v2.6.0-beta.2]
  //                   \
  // rel25:             p1 [v2.5.0-beta.2]
  const repo = newRepo();
  commit(repo, "fork");
  const forkSha = gitq(repo, "rev-parse", "HEAD");
  gitq(repo, "branch", "rel25");
  commit(repo, "m1");
  commit(repo, "m2");
  gitq(repo, "checkout", "-q", "rel25");
  commit(repo, "p1");
  gitq(repo, "tag", "v2.5.0-beta.2");
  gitq(repo, "checkout", "-q", "main");
  gitq(repo, "checkout", "-q", "-b", "rel26");
  commit(repo, "f1");
  gitq(repo, "tag", "v2.6.0-beta.1");
  const beta1Sha = gitq(repo, "rev-parse", "HEAD");
  commit(repo, "f2");
  gitq(repo, "tag", "v2.6.0-beta.2");
  gitq(repo, "tag", "v9.9.9");

  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  const scratch = mkdtempSync(join(tmpdir(), "linear-release-prepare-"));

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    removeRepo(repo);
    rmSync(scratch, { recursive: true, force: true });
  });

  const prepare = async (
    tag: string,
    prerelease: boolean,
    client: ReleaseClient,
  ): Promise<Record<string, string>> => {
    const outputFile = join(scratch, `output-${tag}-${String(prerelease)}`);
    writeFileSync(outputFile, "");
    process.chdir(repo);
    process.env["INPUT_TAG"] = tag;
    process.env["INPUT_PRERELEASE"] = String(prerelease);
    process.env["GITHUB_OUTPUT"] = outputFile;
    process.env["RUNNER_TEMP"] = scratch;
    await runPrepare(client, "Nexus-Mods", "Vortex");
    return parseOutputs(readFileSync(outputFile, "utf8"));
  };

  it("finds the previous tag across diverged branches and emits the fork point", async () => {
    const outputs = await prepare("v2.6.0-beta.1", true, clientWith("the notes"));
    expect(outputs["prevtag"]).toBe("v2.5.0-beta.2");
    expect(outputs["base"]).toBe(forkSha);
    expect(outputs["tag"]).toBe("v2.6.0-beta.1");
    expect(outputs["prerelease"]).toBe("true");
    const notesFile = outputs["notes-file"] ?? "";
    expect(readFileSync(notesFile, "utf8")).toBe("the notes");
  });

  it("uses the previous tag's own commit as base on the same branch", async () => {
    const outputs = await prepare("v2.6.0-beta.2", true, clientWith(null));
    expect(outputs["prevtag"]).toBe("v2.6.0-beta.1");
    expect(outputs["base"]).toBe(beta1Sha);
    expect(outputs["notes-file"]).toBe("");
  });

  it("emits empty prevtag and base for the first release on a channel", async () => {
    const outputs = await prepare("v9.9.9", false, clientWith(null));
    expect(outputs["prevtag"]).toBe("");
    expect(outputs["base"]).toBe("");
  });

  it("rejects a tag that does not exist", async () => {
    await expect(prepare("v0.0.1", false, clientWith(null))).rejects.toThrow(
      'Tag "v0.0.1" not found',
    );
  });
});
