import { beforeEach, describe, expect, vi } from "vitest";

import { makeInstalledCollection, makeMod, makeRule } from "../../../../test-utils/builders";
import { type IHarnessFixtures, test } from "../../../../test-utils/harnessTest";
import type { IApiHarness } from "../../../../test-utils/harnessTypes";
import {
  askCollectionUpdate,
  type CollectionUpdateChoice,
} from "../collection_update_prompt/collectionUpdatePrompt";
import { confirmCollectionModUpdate, selectModsToUpdate } from "./collectionUpdateWarning";

vi.mock("../../../../util/log", () => ({
  log: vi.fn(),
}));

vi.mock("../collection_update_prompt/collectionUpdatePrompt", () => ({
  askCollectionUpdate: vi.fn(),
}));

const GAME = "skyrimse";

const ask = vi.mocked(askCollectionUpdate);
const userChooses = (choice: CollectionUpdateChoice) => ask.mockResolvedValue(choice);

const memberRule = makeRule({ reference: { fileMD5: "md5-member" } });
const otherMemberRule = makeRule({ reference: { fileMD5: "md5-other-member" } });
const member = makeMod({ id: "member", attributes: { fileMD5: "md5-member" } });
const otherMember = makeMod({ id: "other-member", attributes: { fileMD5: "md5-other-member" } });
const standalone = makeMod({ id: "standalone", attributes: { fileMD5: "md5-standalone" } });
const collection = makeInstalledCollection({
  id: "col",
  attributes: { customFileName: "Pack" },
  rules: [memberRule, otherMemberRule],
});
const mods = { member, "other-member": otherMember, standalone, col: collection };

const makeWarningApi = (makeApi: IHarnessFixtures["makeApi"]): IApiHarness =>
  makeApi({ mods: { [GAME]: mods } });

const collectionRules = (harness: IApiHarness) =>
  harness.getState().persistent.mods[GAME].col.rules;

beforeEach(() => {
  ask.mockReset();
});

describe("confirmCollectionModUpdate", () => {
  test("resolves true without asking for a mod in no collection", async ({ makeApi }) => {
    const harness = makeWarningApi(makeApi);

    await expect(confirmCollectionModUpdate(harness.api, GAME, "standalone")).resolves.toBe(true);

    expect(ask).not.toHaveBeenCalled();
  });

  test("resolves true and ignores the collection's pin when the user updates anyway", async ({
    makeApi,
  }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("all");

    await expect(confirmCollectionModUpdate(harness.api, GAME, "member")).resolves.toBe(true);
    expect(collectionRules(harness)).toEqual([{ ...memberRule, ignored: true }, otherMemberRule]);
  });

  test("resolves false and keeps the collection's pin when the user cancels", async ({
    makeApi,
  }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("cancel");

    await expect(confirmCollectionModUpdate(harness.api, GAME, "member")).resolves.toBe(false);
    expect(collectionRules(harness)).toEqual([memberRule, otherMemberRule]);
  });

  test("asks about the collections the mod belongs to", async ({ makeApi }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("cancel");

    await confirmCollectionModUpdate(harness.api, GAME, "member");

    expect(ask).toHaveBeenCalledWith({ kind: "single", collectionNames: ["Pack"] });
  });
});

describe("selectModsToUpdate", () => {
  test("passes straight through when no mod is in a collection", async ({ makeApi }) => {
    const harness = makeWarningApi(makeApi);

    await expect(selectModsToUpdate(harness.api, GAME, ["standalone"])).resolves.toEqual([
      "standalone",
    ]);

    expect(ask).not.toHaveBeenCalled();
  });

  test("updates everything and ignores the collection's pins when the user chooses to", async ({
    makeApi,
  }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("all");

    await expect(
      selectModsToUpdate(harness.api, GAME, ["member", "other-member", "standalone"]),
    ).resolves.toEqual(["member", "other-member", "standalone"]);
    expect(collectionRules(harness)).toEqual([
      { ...memberRule, ignored: true },
      { ...otherMemberRule, ignored: true },
    ]);
  });

  test("drops collection mods when the user chooses non-collection only", async ({ makeApi }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("non-collection");

    await expect(selectModsToUpdate(harness.api, GAME, ["member", "standalone"])).resolves.toEqual([
      "standalone",
    ]);
    expect(collectionRules(harness)).toEqual([memberRule, otherMemberRule]);
  });

  test("updates nothing when the user cancels", async ({ makeApi }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("cancel");

    await expect(selectModsToUpdate(harness.api, GAME, ["member", "standalone"])).resolves.toEqual(
      [],
    );
  });

  test("lists each collection once and reports that non-collection mods are in the batch", async ({
    makeApi,
  }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("cancel");

    await selectModsToUpdate(harness.api, GAME, ["member", "other-member", "standalone"]);

    expect(ask).toHaveBeenCalledWith({
      kind: "batch",
      collectionNames: ["Pack"],
      hasNonCollectionMods: true,
    });
  });

  test("reports when every mod in the batch is in a collection", async ({ makeApi }) => {
    const harness = makeWarningApi(makeApi);
    userChooses("cancel");

    await selectModsToUpdate(harness.api, GAME, ["member", "other-member"]);

    expect(ask).toHaveBeenCalledWith({
      kind: "batch",
      collectionNames: ["Pack"],
      hasNonCollectionMods: false,
    });
  });
});
