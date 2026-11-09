import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { makeProfile } from "../../../test-utils/builders";
import { makeTempDir } from "../../../test-utils/tempDir";
import type { IProfile } from "../../profile_management/types/IProfile";
import { profilePath } from "../../profile_management/util/manage";

// the userlist lives under Vortex's userData folder; point it at a per-test directory
const vortexPaths = vi.hoisted(() => ({ userData: "" }));
vi.mock("../../../util/getVortexPath", () => ({ default: () => vortexPaths.userData }));

import { swapUserlistForProfile, userlistPaths } from "./profileUserlist";

const GAME_ID = "skyrimse";

const plainProfile = (id: string): IProfile => makeProfile({ id, gameId: GAME_ID });
const localRulesProfile = (id: string, overrides: Partial<IProfile> = {}): IProfile =>
  makeProfile({ id, gameId: GAME_ID, features: { local_loot_rules: true }, ...overrides });
// the profile folders depend on the ids alone, whatever features a profile carries
const profileA = plainProfile("a");
const profileB = plainProfile("b");

const missing = (file: string) => expect(stat(file)).rejects.toMatchObject({ code: "ENOENT" });

// a userData folder holding the given files, keyed by path relative to the game folder
async function arrange(files: Record<string, string> = {}) {
  vortexPaths.userData = await makeTempDir("vortex-userlist-");
  const gameDir = path.join(vortexPaths.userData, GAME_ID);
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(gameDir, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  const paths = userlistPaths(GAME_ID);
  const read = (file: string) => readFile(file, "utf8");
  return { paths, read };
}

describe("swapUserlistForProfile", () => {
  it("saves a local-rules profile's rules and restores the global rules on leaving it", async () => {
    const { paths, read } = await arrange({
      "userlist.yaml": "a-rules",
      "userlist.yaml.global": "global",
    });

    await swapUserlistForProfile(localRulesProfile("a"), plainProfile("b"));

    expect(await read(paths.profileFile(profileA))).toBe("a-rules");
    expect(await read(paths.active)).toBe("global");
  });

  it("backs up the global rules and seeds a local-rules profile from them the first time", async () => {
    const { paths, read } = await arrange({ "userlist.yaml": "global" });

    await swapUserlistForProfile(plainProfile("a"), localRulesProfile("b"));

    expect(await read(paths.globalBackup)).toBe("global");
    expect(await read(paths.profileFile(profileB))).toBe("global");
    expect(await read(paths.active)).toBe("global");
  });

  it("restores a local-rules profile's saved rules on entering it", async () => {
    const { paths, read } = await arrange({
      "userlist.yaml": "global",
      "profiles/b/userlist.yaml": "b-rules",
    });

    await swapUserlistForProfile(plainProfile("a"), localRulesProfile("b"));

    expect(await read(paths.active)).toBe("b-rules");
    expect(await read(paths.globalBackup)).toBe("global");
  });

  it("swaps the rules between two local-rules profiles without touching the global backup", async () => {
    const { paths, read } = await arrange({
      "userlist.yaml": "a-rules",
      "profiles/b/userlist.yaml": "b-rules",
    });

    await swapUserlistForProfile(localRulesProfile("a"), localRulesProfile("b"));

    expect(await read(paths.profileFile(profileA))).toBe("a-rules");
    expect(await read(paths.active)).toBe("b-rules");
    await missing(paths.globalBackup);
  });

  it("does not save the rules of a profile that is being removed", async () => {
    const { paths, read } = await arrange({
      "userlist.yaml": "a-rules",
      "userlist.yaml.global": "global",
    });

    await swapUserlistForProfile(
      localRulesProfile("a", { pendingRemove: true }),
      plainProfile("b"),
    );

    await missing(paths.profileFile(profileA));
    expect(await read(paths.active)).toBe("a-rules");
  });

  it("leaves the files alone when neither profile keeps its own rules", async () => {
    const { paths, read } = await arrange({ "userlist.yaml": "global" });

    await swapUserlistForProfile(plainProfile("a"), plainProfile("b"));

    expect(await read(paths.active)).toBe("global");
    await missing(paths.globalBackup);
    await missing(profilePath(profileA));
  });

  it("enters a local-rules profile for the first time without any userlist on disk", async () => {
    const { paths } = await arrange();

    await swapUserlistForProfile(plainProfile("a"), localRulesProfile("b"));

    expect((await stat(profilePath(profileB))).isDirectory()).toBe(true);
    await missing(paths.profileFile(profileB));
    await missing(paths.active);
  });
});
