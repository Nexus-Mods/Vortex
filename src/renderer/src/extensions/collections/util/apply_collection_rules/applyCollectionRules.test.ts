import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readCollection: vi.fn(),
  postprocessCollection: vi.fn(),
}));

vi.mock("@/util/selectors", () => ({
  activeGameId: () => "game",
  installPathForGame: () => "staging",
}));
vi.mock("../readCollection", () => ({ readCollection: mocks.readCollection }));
vi.mock("../../postprocessCollection", () => ({
  postprocessCollection: mocks.postprocessCollection,
}));

import type { IExtensionApi } from "@/types/IExtensionContext";

import { applyCollectionRules } from "./applyCollectionRules";

const makeApi = (mods: object) =>
  ({
    getState: () => ({ persistent: { mods: { game: mods } } }),
    showErrorNotification: vi.fn(),
  }) as unknown as IExtensionApi;

describe("applyCollectionRules", () => {
  beforeEach(() => vi.resetAllMocks());

  it("applies the rules read from the collection's own file", async () => {
    const collection = { id: "x", type: "collection", installationPath: "x-1" };
    const api = makeApi({ x: collection });
    mocks.readCollection.mockResolvedValue({ info: "read" });

    await applyCollectionRules(api, "x");

    expect(mocks.readCollection.mock.calls[0][1]).toMatch(/staging[\\/]x-1[\\/]collection\.json$/);
    expect(mocks.postprocessCollection).toHaveBeenCalledWith(
      api,
      "game",
      collection,
      { info: "read" },
      { x: collection },
    );
  });

  it("does nothing for a mod that isn't a collection", async () => {
    await applyCollectionRules(makeApi({ a: { id: "a", type: "" } }), "a");

    expect(mocks.readCollection).not.toHaveBeenCalled();
  });

  it("reports a collection file it can't read", async () => {
    const api = makeApi({ x: { id: "x", type: "collection", installationPath: "x-1" } });
    mocks.readCollection.mockRejectedValue(new Error("gone"));

    await applyCollectionRules(api, "x");

    expect(api.showErrorNotification).toHaveBeenCalledWith(
      "Failed to read collection info",
      expect.any(Error),
      expect.anything(),
    );
    expect(mocks.postprocessCollection).not.toHaveBeenCalled();
  });

  it("reports rules it can't apply", async () => {
    const api = makeApi({ x: { id: "x", type: "collection", installationPath: "x-1" } });
    mocks.readCollection.mockResolvedValue({});
    mocks.postprocessCollection.mockRejectedValue(new Error("bad"));

    await applyCollectionRules(api, "x");

    expect(api.showErrorNotification).toHaveBeenCalledWith(
      "Failed to apply collection rules",
      expect.any(Error),
      expect.anything(),
    );
  });
});
