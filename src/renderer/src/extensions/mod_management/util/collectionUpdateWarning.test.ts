import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeInstalledCollection, makeMod, makeRule } from "../../../test-utils/builders";
import { askCollectionUpdate, type CollectionUpdateChoice } from "./collectionUpdatePrompt";
import { confirmCollectionModUpdate, selectModsToUpdate } from "./collectionUpdateWarning";

vi.mock("../../../util/log", () => ({
  log: vi.fn(),
}));

vi.mock("./collectionUpdatePrompt", () => ({
  askCollectionUpdate: vi.fn(),
}));

const ask = vi.mocked(askCollectionUpdate);
const userChooses = (choice: CollectionUpdateChoice) => ask.mockResolvedValue(choice);

beforeEach(() => {
  ask.mockReset();
});

describe("confirmCollectionModUpdate", () => {
  it("resolves true when the user chooses to update anyway", async () => {
    userChooses("all");

    await expect(confirmCollectionModUpdate(["Pack"])).resolves.toBe(true);
  });

  it("resolves false when the user cancels", async () => {
    userChooses("cancel");

    await expect(confirmCollectionModUpdate(["Pack"])).resolves.toBe(false);
  });

  it("asks about the collections the mod belongs to", async () => {
    userChooses("cancel");

    await confirmCollectionModUpdate(["Pack", "Second Pack"]);

    expect(ask).toHaveBeenCalledWith({
      kind: "single",
      collectionNames: ["Pack", "Second Pack"],
    });
  });
});

describe("selectModsToUpdate", () => {
  const member = makeMod({ id: "member", attributes: { fileMD5: "md5-member" } });
  const otherMember = makeMod({ id: "other-member", attributes: { fileMD5: "md5-other-member" } });
  const standalone = makeMod({ id: "standalone", attributes: { fileMD5: "md5-standalone" } });
  const collection = makeInstalledCollection({
    id: "col",
    attributes: { customFileName: "Pack" },
    rules: [
      makeRule({ reference: { fileMD5: "md5-member" } }),
      makeRule({ reference: { fileMD5: "md5-other-member" } }),
    ],
  });
  const mods = { member, "other-member": otherMember, standalone, col: collection };

  it("passes straight through when no mod is in a collection", async () => {
    await expect(selectModsToUpdate(mods, ["standalone"])).resolves.toEqual(["standalone"]);

    expect(ask).not.toHaveBeenCalled();
  });

  it("updates everything when the user chooses to", async () => {
    userChooses("all");

    await expect(selectModsToUpdate(mods, ["member", "standalone"])).resolves.toEqual([
      "member",
      "standalone",
    ]);
  });

  it("drops collection mods when the user chooses non-collection only", async () => {
    userChooses("non-collection");

    await expect(selectModsToUpdate(mods, ["member", "standalone"])).resolves.toEqual([
      "standalone",
    ]);
  });

  it("updates nothing when the user cancels", async () => {
    userChooses("cancel");

    await expect(selectModsToUpdate(mods, ["member", "standalone"])).resolves.toEqual([]);
  });

  it("lists each collection once and reports that non-collection mods are in the batch", async () => {
    userChooses("cancel");

    await selectModsToUpdate(mods, ["member", "other-member", "standalone"]);

    expect(ask).toHaveBeenCalledWith({
      kind: "batch",
      collectionNames: ["Pack"],
      hasNonCollectionMods: true,
    });
  });

  it("reports when every mod in the batch is in a collection", async () => {
    userChooses("cancel");

    await selectModsToUpdate(mods, ["member", "other-member"]);

    expect(ask).toHaveBeenCalledWith({
      kind: "batch",
      collectionNames: ["Pack"],
      hasNonCollectionMods: false,
    });
  });
});
