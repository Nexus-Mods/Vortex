import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { OPTION_SNAPSHOT_ATTRIBUTE } from "../../installer_fomod_shared/types/snapshot";
import { checkFomodOptions, type IFomodOptionsCheckMetadata } from "./fomodOptionsCheck";

const pluginCondition = (path: string, state: string) => ({
  kind: "Plugin",
  pluginPath: path,
  pluginState: state,
});

const snapshotWith = (options: unknown[]) => ({
  steps: [
    {
      id: 0,
      name: "Step1",
      visible: true,
      groups: [{ name: "Compat", type: "SelectAny", options }],
    },
  ],
  flags: [],
});

const gatedOption = (overrides: Record<string, unknown> = {}) => ({
  name: "Patch for Mod B",
  type: "NotUsable",
  selected: false,
  flags: [],
  resolver: {
    kind: "Conditional",
    defaultType: "NotUsable",
    patterns: [{ type: "Required", condition: pluginCondition("b.esp", "Active") }],
  },
  ...overrides,
});

interface IFakeOptions {
  mods?: Record<string, unknown>;
  pluginList?: Record<string, { isNative: boolean }>;
  loadOrder?: Record<string, { enabled: boolean | "ghost" }>;
}

const fakeApi = (opts: IFakeOptions): IExtensionApi =>
  ({
    getState: () =>
      ({
        // activeGameId reads the active profile's game id, not a session field.
        persistent: {
          mods: { skyrimse: opts.mods ?? {} },
          profiles: { p1: { id: "p1", gameId: "skyrimse" } },
        },
        settings: { profiles: { activeProfileId: "p1" } },
        session: { plugins: { pluginList: opts.pluginList ?? {} } },
        loadOrder: opts.loadOrder ?? {},
      }) as unknown as IState,
  }) as unknown as IExtensionApi;

describe("checkFomodOptions", () => {
  it("reports an option that has become usable", async () => {
    const api = fakeApi({
      mods: {
        "mod-a": {
          id: "mod-a",
          attributes: {
            customFileName: "Mod A",
            [OPTION_SNAPSHOT_ATTRIBUTE]: snapshotWith([gatedOption()]),
          },
        },
      },
      pluginList: { "b.esp": { isNative: false } },
      loadOrder: { "b.esp": { enabled: true } },
    });

    const result = await checkFomodOptions(api);
    const metadata = result.metadata as IFomodOptionsCheckMetadata;

    expect(result.status).toBe("warning");
    expect(metadata.issues).toHaveLength(1);
    expect(metadata.issues[0].modId).toBe("mod-a");
    expect(metadata.issues[0].options[0].optionName).toBe("Patch for Mod B");
    expect(metadata.issues[0].options[0].reason).toBe("b.esp");
  });

  it("says nothing when the gating plugin is still absent", async () => {
    const api = fakeApi({
      mods: {
        "mod-a": {
          id: "mod-a",
          attributes: { [OPTION_SNAPSHOT_ATTRIBUTE]: snapshotWith([gatedOption()]) },
        },
      },
      pluginList: {},
    });

    const result = await checkFomodOptions(api);
    expect(result.status).toBe("passed");
    expect((result.metadata as IFomodOptionsCheckMetadata).issues).toHaveLength(0);
  });

  it("says nothing when the gating plugin is present but disabled", async () => {
    // Installing Mod B only helps if its plugin is actually active.
    const api = fakeApi({
      mods: {
        "mod-a": {
          id: "mod-a",
          attributes: { [OPTION_SNAPSHOT_ATTRIBUTE]: snapshotWith([gatedOption()]) },
        },
      },
      pluginList: { "b.esp": { isNative: false } },
      loadOrder: { "b.esp": { enabled: false } },
    });

    const result = await checkFomodOptions(api);
    expect(result.status).toBe("passed");
  });

  it("says nothing about an option the user already selected", async () => {
    const api = fakeApi({
      mods: {
        "mod-a": {
          id: "mod-a",
          attributes: {
            [OPTION_SNAPSHOT_ATTRIBUTE]: snapshotWith([gatedOption({ selected: true })]),
          },
        },
      },
      pluginList: { "b.esp": { isNative: false } },
      loadOrder: { "b.esp": { enabled: true } },
    });

    const result = await checkFomodOptions(api);
    expect(result.status).toBe("passed");
  });

  it("says nothing about an option gated on the mod's own plugin", async () => {
    // The plugin arrives with the mod, so it is absent only while the mod is not deployed.
    const api = fakeApi({
      mods: {
        "mod-a": {
          id: "mod-a",
          attributes: {
            [OPTION_SNAPSHOT_ATTRIBUTE]: snapshotWith([
              gatedOption({
                resolver: {
                  kind: "Conditional",
                  defaultType: "NotUsable",
                  patterns: [{ type: "Required", condition: pluginCondition("a.esp", "Active") }],
                },
              }),
            ]),
            fileList: [{ path: "a.esp" }],
          },
        },
      },
      pluginList: { "a.esp": { isNative: false } },
      loadOrder: { "a.esp": { enabled: true } },
    });

    const result = await checkFomodOptions(api);
    expect(result.status).toBe("passed");
  });

  it("counts mods it could not check rather than failing", async () => {
    // An install from an installer that predates the snapshot records choices but no
    // snapshot. That is not an error, and the user should be told it is not covered.
    const api = fakeApi({
      mods: {
        "mod-old": {
          id: "mod-old",
          attributes: { installerChoices: { type: "fomod", options: [] } },
        },
      },
    });

    const result = await checkFomodOptions(api);
    const metadata = result.metadata as IFomodOptionsCheckMetadata;
    expect(result.status).toBe("passed");
    expect(metadata.modsWithoutSnapshot).toBe(1);
    expect(metadata.modsChecked).toBe(0);
  });

  it("marks a collection-managed mod so a fix does not silently break the collection", async () => {
    const api = fakeApi({
      mods: {
        "mod-a": {
          id: "mod-a",
          attributes: {
            [OPTION_SNAPSHOT_ATTRIBUTE]: snapshotWith([gatedOption()]),
            referenceTag: "collection-rule-1",
          },
        },
      },
      pluginList: { "b.esp": { isNative: false } },
      loadOrder: { "b.esp": { enabled: true } },
    });

    const result = await checkFomodOptions(api);
    const metadata = result.metadata as IFomodOptionsCheckMetadata;
    expect(metadata.issues[0].collectionManaged).toBe(true);
  });
});
