import { VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { makeMod } from "@/test-utils/builders";

import { modAttributeActions } from "./modAttributeActions";

const GAME = VortexGameId("skyrimse");

describe("modAttributeActions", () => {
  it("sets an installed mod's attribute on the mod", () => {
    expect(modAttributeActions(GAME, [makeMod({ id: "a" })], "source", "nexus")).toMatchObject([
      {
        type: "SET_MOD_ATTRIBUTE",
        payload: { gameId: GAME, modId: "a", attribute: "source", value: "nexus" },
      },
    ]);
  });

  it("sets a downloaded mod's on its download, under the key the download keeps it", () => {
    const downloaded = makeMod({ id: "archive", state: "downloaded" });

    expect(modAttributeActions(GAME, [downloaded], "category", "12")).toMatchObject([
      {
        type: "SET_DOWNLOAD_MODINFO",
        payload: { id: "archive", key: "custom.category", value: "12" },
      },
    ]);
    expect(modAttributeActions(GAME, [downloaded], "source", "website")).toMatchObject([
      { payload: { id: "archive", key: "source", value: "website" } },
    ]);
  });

  it("sets each of several mods, in order", () => {
    const actions = modAttributeActions(
      GAME,
      [makeMod({ id: "a" }), makeMod({ id: "b", state: "downloaded" })],
      "category",
      "",
    );

    expect(actions.map(({ type }) => type)).toEqual(["SET_MOD_ATTRIBUTE", "SET_DOWNLOAD_MODINFO"]);
  });

  it("passes undefined through, clearing the attribute", () => {
    const actions = modAttributeActions(
      GAME,
      [makeMod({ id: "a" }), makeMod({ id: "b", state: "downloaded" })],
      "category",
      undefined,
    );

    expect(actions).toMatchObject([
      { type: "SET_MOD_ATTRIBUTE", payload: { modId: "a", attribute: "category" } },
      { type: "SET_DOWNLOAD_MODINFO", payload: { id: "b", key: "custom.category" } },
    ]);
    expect(
      actions.map((action) => (action as unknown as { payload: { value: unknown } }).payload.value),
    ).toEqual([undefined, undefined]);
  });
});
