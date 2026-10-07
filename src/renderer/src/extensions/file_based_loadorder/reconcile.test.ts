import { describe, expect, it } from "vitest";

import { makeLoadOrderEntry, makeMod } from "../../test-utils/builders";
import type { IMod, IModAttributes } from "../mod_management/types/IMod";
import { reconcileLoadOrder } from "./reconcile";
import type { ILoadOrderEntry, LoadOrder } from "./types/types";

const entry = (id: string, overrides: Partial<ILoadOrderEntry> = {}) =>
  makeLoadOrderEntry({ id, ...overrides });

const ids = (loadOrder: readonly ILoadOrderEntry[]) => loadOrder.map((item) => item.id);

// the game's mods keyed by Vortex mod id, each with the Nexus attributes given
const modsByVortexModId = (
  attributesByVortexModId: Record<string, IModAttributes>,
): Record<string, IMod> =>
  Object.fromEntries(
    Object.entries(attributesByVortexModId).map(([vortexModId, attributes]) => [
      vortexModId,
      makeMod({ id: vortexModId, attributes }),
    ]),
  );

const noMods = modsByVortexModId({});

describe("reconcileLoadOrder", () => {
  it("puts entries the game reports back in their stored order", () => {
    const stored = [entry("a.pak"), entry("b.pak"), entry("c.pak")];
    const fromGame = [entry("c.pak"), entry("a.pak"), entry("b.pak")];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual(["a.pak", "b.pak", "c.pak"]);
  });

  it("keeps a new entry in the slot the game gave it", () => {
    const stored = [entry("a.pak"), entry("b.pak"), entry("c.pak")];
    const fromGame = [entry("c.pak"), entry("a.pak"), entry("new.pak"), entry("b.pak")];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual([
      "a.pak",
      "b.pak",
      "new.pak",
      "c.pak",
    ]);
  });

  it("drops a stored entry the game no longer reports", () => {
    const stored = [entry("a.pak"), entry("gone.pak"), entry("b.pak")];
    const fromGame = [entry("b.pak"), entry("a.pak")];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual(["a.pak", "b.pak"]);
  });

  it("returns the game's entries, not the stored copies", () => {
    const stored = [entry("a.pak", { enabled: true })];
    const fromGame = [entry("a.pak", { enabled: false })];

    expect(reconcileLoadOrder(stored, fromGame, noMods)).toEqual(fromGame);
  });

  it("matches an entry by id when its mod was reinstalled under a new Vortex id", () => {
    const stored = [entry("b.pak", { modId: "mod-b" }), entry("a.pak", { modId: "mod-old" })];
    const fromGame = [entry("a.pak", { modId: "mod-new" }), entry("b.pak", { modId: "mod-b" })];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual(["b.pak", "a.pak"]);
  });

  it("keeps each pak of a manually installed mod at its own position", () => {
    const stored = [
      entry("b.pak", { modId: "manual" }),
      entry("x.pak"),
      entry("a.pak", { modId: "manual" }),
    ];
    const fromGame = [
      entry("a.pak", { modId: "manual" }),
      entry("b.pak", { modId: "manual" }),
      entry("x.pak"),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual(["b.pak", "x.pak", "a.pak"]);
  });

  it("keeps an updated mod's paks where they were when the update renames their entries", () => {
    // an update keeps the Vortex mod id, so a manual mod with no Nexus id still matches by name
    const stored = [
      entry("a-1.0", { name: "A", modId: "manual" }),
      entry("x.pak"),
      entry("b-1.0", { name: "B", modId: "manual" }),
    ];
    const fromGame = [
      entry("a-2.0", { name: "A", modId: "manual" }),
      entry("b-2.0", { name: "B", modId: "manual" }),
      entry("x.pak"),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual(["a-2.0", "x.pak", "b-2.0"]);
  });

  it("keeps an updated Nexus mod's paks where they were when their ids change", () => {
    // a newer version of mod 42 installed by hand under a new Vortex id
    const mods = modsByVortexModId({
      "mod-old": { modId: 42, fileId: 1 },
      "mod-new": { modId: 42, fileId: 2 },
    });
    const stored = [
      entry("old-a", { name: "A", modId: "mod-old" }),
      entry("x.pak"),
      entry("old-b", { name: "B", modId: "mod-old" }),
    ];
    const fromGame = [
      entry("new-a", { name: "A", modId: "mod-new" }),
      entry("new-b", { name: "B", modId: "mod-new" }),
      entry("x.pak"),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, mods))).toEqual(["new-a", "x.pak", "new-b"]);
  });

  it("matches a mod whose Nexus id is stored as a string to one stored as a number", () => {
    const mods = modsByVortexModId({
      "mod-old": { modId: "42" as unknown as number },
      "mod-new": { modId: 42 },
    });
    const stored = [entry("old-a", { name: "A", modId: "mod-old" }), entry("x.pak")];
    const fromGame = [entry("x.pak"), entry("new-a", { name: "A", modId: "mod-new" })];

    expect(ids(reconcileLoadOrder(stored, fromGame, mods))).toEqual(["new-a", "x.pak"]);
  });

  it("keeps each file of one mod page at its own position when their entries share a name", () => {
    // a main and an optional file from one page, installed as two Vortex mods
    const mods = modsByVortexModId({
      "mod-main": { modId: 42, fileId: 5 },
      "mod-optional": { modId: 42, fileId: 7 },
    });
    const stored = [
      entry("optional-patch", { name: "patch", modId: "mod-optional" }),
      entry("x.pak"),
      entry("main-patch", { name: "patch", modId: "mod-main" }),
    ];
    const fromGame = [
      entry("main-patch", { name: "patch", modId: "mod-main" }),
      entry("optional-patch", { name: "patch", modId: "mod-optional" }),
      entry("x.pak"),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, mods))).toEqual([
      "optional-patch",
      "x.pak",
      "main-patch",
    ]);
  });

  it("keeps a file of one mod page at its position when it comes back under a new Vortex id", () => {
    // both files of page 42 ship "patch"; the optional file is reinstalled as a new Vortex mod
    const mods = modsByVortexModId({
      "mod-main": { modId: 42, fileId: 5 },
      "mod-optional": { modId: 42, fileId: 7 },
      "mod-optional-2": { modId: 42, fileId: 7 },
    });
    const stored = [
      entry("optional-patch", { name: "patch", modId: "mod-optional" }),
      entry("x.pak"),
      entry("main-patch", { name: "patch", modId: "mod-main" }),
    ];
    const fromGame = [
      entry("x.pak"),
      entry("main-patch", { name: "patch", modId: "mod-main" }),
      entry("optional-patch-2", { name: "patch", modId: "mod-optional-2" }),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, mods))).toEqual([
      "optional-patch-2",
      "x.pak",
      "main-patch",
    ]);
  });

  it("does not guess between two files of one mod page when one comes back without a file id", () => {
    const mods = modsByVortexModId({
      "mod-main": { modId: 42 },
      "mod-optional": { modId: 42 },
      "mod-optional-2": { modId: 42 },
    });
    const stored = [
      entry("optional-patch", { name: "patch", modId: "mod-optional" }),
      entry("x.pak"),
      entry("main-patch", { name: "patch", modId: "mod-main" }),
    ];
    const fromGame = [
      entry("x.pak"),
      entry("main-patch", { name: "patch", modId: "mod-main" }),
      entry("optional-patch-2", { name: "patch", modId: "mod-optional-2" }),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, mods))).toEqual([
      "x.pak",
      "main-patch",
      "optional-patch-2",
    ]);
  });

  it("does not guess between two installs of one file when both come back under new Vortex ids", () => {
    // two variants installed from the same Nexus file, each shipping "patch"
    const mods = modsByVortexModId({
      "variant-1": { modId: 42, fileId: 7 },
      "variant-2": { modId: 42, fileId: 7 },
      "variant-1-new": { modId: 42, fileId: 7 },
      "variant-2-new": { modId: 42, fileId: 7 },
    });
    const stored = [
      entry("variant-1-patch", { name: "patch", modId: "variant-1" }),
      entry("x.pak"),
      entry("variant-2-patch", { name: "patch", modId: "variant-2" }),
    ];
    const fromGame = [
      entry("variant-2-patch-new", { name: "patch", modId: "variant-2-new" }),
      entry("x.pak"),
      entry("variant-1-patch-new", { name: "patch", modId: "variant-1-new" }),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, mods))).toEqual([
      "variant-2-patch-new",
      "x.pak",
      "variant-1-patch-new",
    ]);
  });

  it("does not match paks of different Nexus mods that share a name", () => {
    const mods = modsByVortexModId({ "mod-1": { modId: 1 }, "mod-2": { modId: 2 } });
    const stored = [entry("x.pak"), entry("one", { name: "patch", modId: "mod-1" })];
    const fromGame = [entry("two", { name: "patch", modId: "mod-2" }), entry("x.pak")];

    expect(ids(reconcileLoadOrder(stored, fromGame, mods))).toEqual(["two", "x.pak"]);
  });

  it("matches an entry without a mod by id", () => {
    const stored = [entry("ext.pak"), entry("a.pak", { modId: "mod-a" })];
    const fromGame = [entry("a.pak", { modId: "mod-a" }), entry("ext.pak")];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual(["ext.pak", "a.pak"]);
  });

  it("leaves a locked entry where the game put it and restores the unlocked ones around it", () => {
    const stored = [
      entry("a.pak"),
      entry("native.esm", { locked: true }),
      entry("b.pak"),
      entry("c.pak"),
    ];
    const fromGame = [
      entry("native.esm", { locked: true }),
      entry("c.pak"),
      entry("a.pak"),
      entry("b.pak"),
    ];

    expect(ids(reconcileLoadOrder(stored, fromGame, noMods))).toEqual([
      "native.esm",
      "a.pak",
      "b.pak",
      "c.pak",
    ]);
  });

  it("keeps a mod's position in each of two load orders independently", () => {
    const archiveStored = [entry("shared.pak"), entry("a.pak")];
    const redmodStored = [entry("r.pak"), entry("shared.pak")];
    const fromGame = (...names: string[]) => names.map((name) => entry(name));

    expect(ids(reconcileLoadOrder(archiveStored, fromGame("a.pak", "shared.pak"), noMods))).toEqual(
      ["shared.pak", "a.pak"],
    );
    expect(ids(reconcileLoadOrder(redmodStored, fromGame("shared.pak", "r.pak"), noMods))).toEqual([
      "r.pak",
      "shared.pak",
    ]);
  });

  describe("when the game reports nothing", () => {
    const stored = [entry("a.pak"), entry("b.pak")];

    it.for<LoadOrder | undefined>([undefined, []])("keeps the stored order for %j", (fromGame) => {
      expect(reconcileLoadOrder(stored, fromGame, noMods)).toEqual(stored);
    });

    it("returns an empty order when nothing is stored either", () => {
      expect(reconcileLoadOrder(undefined, undefined, noMods)).toEqual([]);
    });
  });

  it("takes the game's order as it is when nothing is stored", () => {
    const fromGame = [entry("b.pak"), entry("a.pak")];

    expect(reconcileLoadOrder(undefined, fromGame, noMods)).toEqual(fromGame);
  });
});
