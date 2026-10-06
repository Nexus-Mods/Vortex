import { describe, expect, it, vi } from "vitest";

import { makeInstalledCollection, makeMod, makeRule } from "../../../test-utils/builders";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import {
  CANCEL,
  COLLECTION_UPDATE_DIALOG_ID,
  collectionModsUpdateAllDialog,
  collectionModUpdateDialog,
  confirmCollectionModUpdate,
  selectModsToUpdate,
  UPDATE_ALL,
  UPDATE_ANYWAY,
  UPDATE_NON_COLLECTION,
} from "./collectionUpdateWarning";

vi.mock("../../../util/log", () => ({
  log: vi.fn(),
}));

const tick = (content: ReturnType<typeof collectionModUpdateDialog>) => ({
  ...content,
  checkboxes: content.checkboxes?.map((box) => ({ ...box, value: true })),
});

const apiResolving = (action: string) =>
  ({ showDialog: vi.fn().mockResolvedValue({ action, input: {} }) }) as unknown as IExtensionApi;

describe("collectionModUpdateDialog", () => {
  it("lists every collection the mod belongs to", () => {
    const content = collectionModUpdateDialog(["Immersive and Adult", "Second Pack"]);

    expect(content.md).toContain("**Immersive and Adult**");
    expect(content.md).toContain("**Second Pack**");
  });

  it("trims whitespace around collection names so the bold markup renders", () => {
    const content = collectionModUpdateDialog(["HxW Furniture Suite "]);

    expect(content.md).toContain("**HxW Furniture Suite**");
  });

  it("escapes markdown in collection names", () => {
    const content = collectionModUpdateDialog(["Ultimate *Edition* [v2]"]);

    expect(content.md).toContain("**Ultimate \\*Edition\\* \\[v2\\]**");
  });

  it("blocks Update anyway until the box is ticked", () => {
    const content = collectionModUpdateDialog(["Pack"]);

    expect(content.condition?.(content)).toEqual([
      expect.objectContaining({ actions: [UPDATE_ANYWAY] }),
    ]);
  });

  it("unblocks Update anyway once the box is ticked", () => {
    const content = collectionModUpdateDialog(["Pack"]);

    expect(content.condition?.(tick(content))).toEqual([]);
  });

  it("never blocks Cancel", () => {
    const content = collectionModUpdateDialog(["Pack"]);

    const blocked = content.condition?.(content).flatMap((result) => result.actions);

    expect(blocked).not.toContain(CANCEL);
  });
});

describe("confirmCollectionModUpdate", () => {
  it("resolves true when the user picks Update anyway", async () => {
    await expect(confirmCollectionModUpdate(apiResolving(UPDATE_ANYWAY), ["Pack"])).resolves.toBe(
      true,
    );
  });

  it("resolves false when the user cancels", async () => {
    await expect(confirmCollectionModUpdate(apiResolving(CANCEL), ["Pack"])).resolves.toBe(false);
  });

  it("offers Cancel and Update anyway", async () => {
    const api = apiResolving(CANCEL);

    await confirmCollectionModUpdate(api, ["Pack"]);

    expect(api.showDialog).toHaveBeenCalledWith(
      "question",
      "Update this mod?",
      expect.anything(),
      [{ label: CANCEL }, { label: UPDATE_ANYWAY }],
      COLLECTION_UPDATE_DIALOG_ID,
    );
  });
});

describe("collectionModsUpdateAllDialog", () => {
  it("lists the collections and recommends updating only non-collection mods", () => {
    const content = collectionModsUpdateAllDialog(["Immersive and Adult"], true);

    expect(content.md).toContain("**Immersive and Adult**");
    expect(content.md).toContain("**Recommended:**");
  });

  it("drops the recommendation when every mod is in a collection", () => {
    const content = collectionModsUpdateAllDialog(["Immersive and Adult"], false);

    expect(content.md).not.toContain("Recommended");
  });

  it("blocks Update all until the box is ticked, and never the other buttons", () => {
    const content = collectionModsUpdateAllDialog(["Pack"], true);

    const blocked = content.condition?.(content).flatMap((result) => result.actions);

    expect(blocked).toEqual([UPDATE_ALL]);
    expect(content.condition?.(tick(content))).toEqual([]);
  });
});

describe("selectModsToUpdate", () => {
  const member = makeMod({ id: "member", attributes: { fileMD5: "md5-member" } });
  const other = makeMod({ id: "other", attributes: { fileMD5: "md5-other" } });
  const collection = makeInstalledCollection({
    id: "col",
    attributes: { customFileName: "Pack" },
    rules: [makeRule({ reference: { fileMD5: "md5-member" } })],
  });
  const mods = { member, other, col: collection };

  it("passes straight through when no mod is in a collection", async () => {
    const api = apiResolving(CANCEL);

    await expect(selectModsToUpdate(api, mods, ["other"])).resolves.toEqual(["other"]);
    expect(api.showDialog).not.toHaveBeenCalled();
  });

  it("updates everything when the user picks Update all", async () => {
    const api = apiResolving(UPDATE_ALL);

    await expect(selectModsToUpdate(api, mods, ["member", "other"])).resolves.toEqual([
      "member",
      "other",
    ]);
  });

  it("drops collection mods when the user picks Update non-collection mods", async () => {
    const api = apiResolving(UPDATE_NON_COLLECTION);

    await expect(selectModsToUpdate(api, mods, ["member", "other"])).resolves.toEqual(["other"]);
  });

  it("updates nothing when the user cancels", async () => {
    const api = apiResolving(CANCEL);

    await expect(selectModsToUpdate(api, mods, ["member", "other"])).resolves.toEqual([]);
  });

  it("offers no non-collection button when every mod is in a collection", async () => {
    const api = apiResolving(CANCEL);

    await selectModsToUpdate(api, mods, ["member"]);

    expect(api.showDialog).toHaveBeenCalledWith(
      "question",
      "Some mods are part of a collection",
      expect.anything(),
      [{ label: CANCEL }, { label: UPDATE_ALL }],
      COLLECTION_UPDATE_DIALOG_ID,
    );
  });

  it("makes the recommended non-collection option the default", async () => {
    const api = apiResolving(CANCEL);

    await selectModsToUpdate(api, mods, ["member", "other"]);

    expect(api.showDialog).toHaveBeenCalledWith(
      "question",
      expect.anything(),
      expect.anything(),
      [{ label: CANCEL }, { label: UPDATE_ALL }, { label: UPDATE_NON_COLLECTION, default: true }],
      COLLECTION_UPDATE_DIALOG_ID,
    );
  });
});
