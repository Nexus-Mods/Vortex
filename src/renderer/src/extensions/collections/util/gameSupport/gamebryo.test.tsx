/**
 * Regression coverage for the gamebryo collection parser's plugin force-enable.
 *
 * The parser builds the member set from the collection mod's dependency rules and then dispatches
 * SET_PLUGIN_ENABLED for every plugin those members ship. It must read those rules from CURRENT
 * state, not from the collectionMod argument: postprocess passes a snapshot captured when
 * did-install-dependencies fired, and the parser only runs after a deploy-mods await, by which
 * point that snapshot can predate the member rules. Reading the stale snapshot left whole
 * collections with their plugins disabled.
 *
 * fs (staging-folder scan) and installPathForGame (electron paths) are stubbed at the module
 * boundary so the parser runs without disk or a real install path; everything else is the shared
 * fake-api harness and builders. Plugin names keep their real mixed casing so the test exercises
 * both the exact-name match in isEnabled and the lowercase keying in the loadOrder reducer.
 */
import { describe, expect, it, vi } from "vitest";

import { makeApiHarness, makeMod, makeReference, makeRule } from "../../../../test-utils/builders";
import type * as fsModule from "../../../../util/fs";
import type * as selectorsModule from "../../../../util/selectors";
import type { IMod } from "../../../mod_management/types/IMod";
import { MOD_TYPE } from "../../constants";
import type { ICollection } from "../../types/ICollection";
import { parser } from "./gamebryo";

const { readdirAsyncMock } = vi.hoisted(() => ({ readdirAsyncMock: vi.fn() }));

vi.mock("../../../../util/fs", async (importOriginal) => ({
  ...(await importOriginal<typeof fsModule>()),
  readdirAsync: (...args: unknown[]) => readdirAsyncMock(...args),
}));

vi.mock("../../../../util/selectors", async (importOriginal) => ({
  ...(await importOriginal<typeof selectorsModule>()),
  installPathForGame: () => "staging",
}));

const GAME_ID = "skyrimse";
const COLLECTION_ID = "col-1";

// Each member is a reference tag, its own staging folder, and the plugin files that folder holds
// (a non-plugin file is mixed in to prove extension filtering). The union is what the parser
// should force-enable; ALL_PLUGINS is that union pre-sorted for comparison.
const MEMBERS = [
  { tag: "a", installationPath: "mods/inst-a", plugins: ["MiriFollower.esp"] },
  { tag: "b", installationPath: "mods/inst-b", plugins: ["Immersive Sounds.esp", "BijinAIO.esp"] },
  { tag: "c", installationPath: "mods/inst-c", plugins: ["RaceCompatibility.esm", "ReadMe.txt"] },
];
const ALL_PLUGINS = [
  "BijinAIO.esp",
  "Immersive Sounds.esp",
  "MiriFollower.esp",
  "RaceCompatibility.esm",
];

function seedReaddir(): void {
  readdirAsyncMock.mockImplementation((dir: string) => {
    const member = MEMBERS.find((m) => String(dir).includes(`inst-${m.tag}`));
    return Promise.resolve(member !== undefined ? member.plugins : []);
  });
}

function memberMods(): Record<string, IMod> {
  const map: Record<string, IMod> = {};
  for (const member of MEMBERS) {
    map[`inst-${member.tag}`] = makeMod({
      id: `inst-${member.tag}`,
      installationPath: member.installationPath,
      attributes: { referenceTag: member.tag },
    });
  }
  return map;
}

function collectionRules() {
  return MEMBERS.map((member) =>
    makeRule({ type: "requires", reference: makeReference({ tag: member.tag }) }),
  );
}

function makeCollection(pluginEnabled: Record<string, boolean>): ICollection {
  return {
    plugins: Object.entries(pluginEnabled).map(([name, enabled]) => ({ name, enabled })),
    pluginRules: { plugins: [], groups: [] },
  } as unknown as ICollection;
}

// Build a harness whose persistent.mods holds the member mods plus, unless withCollectionMod is
// false, the fully-ruled collection mod. userlist + session.notifications are slices the parser
// reads that the driver harness doesn't seed by default.
function makeHarness(withCollectionMod = true) {
  const modsMap = memberMods();
  if (withCollectionMod) {
    modsMap[COLLECTION_ID] = makeMod({
      id: COLLECTION_ID,
      type: MOD_TYPE,
      rules: collectionRules(),
    });
  }

  const harness = makeApiHarness({ mods: { [GAME_ID]: modsMap } });
  harness.setState((draft) => {
    const seed = draft as unknown as {
      userlist: { plugins: unknown[]; groups: unknown[] };
      session: { notifications: { notifications: unknown[] } };
    };
    seed.userlist = { plugins: [], groups: [] };
    seed.session.notifications = { notifications: [] };
  });
  return harness;
}

function pluginEnableActions(harness: ReturnType<typeof makeApiHarness>) {
  return harness.dispatched
    .filter((action) => action.type === "SET_PLUGIN_ENABLED")
    .map((action) => action.payload as { pluginName: string; enabled: boolean });
}

describe("gamebryo collection parser plugin force-enable", () => {
  it("enables every member plugin even when the passed-in collectionMod's rules are stale", async () => {
    seedReaddir();
    const harness = makeHarness();
    // the snapshot the driver would hand postprocess: same id, but its rules predate the members
    const staleCollectionMod = makeMod({ id: COLLECTION_ID, type: MOD_TYPE, rules: [] });

    await parser(harness.api, GAME_ID, makeCollection({}), staleCollectionMod);

    expect(
      pluginEnableActions(harness)
        .map((a) => a.pluginName)
        .sort(),
    ).toEqual(ALL_PLUGINS);
  });

  it("propagates each plugin's enabled state from the collection manifest", async () => {
    seedReaddir();
    const harness = makeHarness();
    const staleCollectionMod = makeMod({ id: COLLECTION_ID, type: MOD_TYPE, rules: [] });
    const collection = makeCollection({
      "MiriFollower.esp": true,
      "Immersive Sounds.esp": false,
      "BijinAIO.esp": true,
      "RaceCompatibility.esm": true,
    });

    await parser(harness.api, GAME_ID, collection, staleCollectionMod);

    const byName = Object.fromEntries(
      pluginEnableActions(harness).map((a) => [a.pluginName, a.enabled]),
    );
    expect(byName).toEqual({
      "MiriFollower.esp": true,
      "Immersive Sounds.esp": false,
      "BijinAIO.esp": true,
      "RaceCompatibility.esm": true,
    });
  });

  it("falls back to the passed-in collectionMod when the mod is absent from current state", async () => {
    seedReaddir();
    const harness = makeHarness(false);
    const collectionMod = makeMod({ id: COLLECTION_ID, type: MOD_TYPE, rules: collectionRules() });

    await parser(harness.api, GAME_ID, makeCollection({}), collectionMod);

    expect(
      pluginEnableActions(harness)
        .map((a) => a.pluginName)
        .sort(),
    ).toEqual(ALL_PLUGINS);
  });
});
