import { describe, it, expect, beforeAll } from "vitest";

import { attributeExtractor, upgradeExtractor } from "./extractors";
import filterModInfo, { registerAttributeExtractor } from "./filterModInfo";

// Regression test for https://github.com/Nexus-Mods/Vortex/issues/23298
//
// Reinstalling a mod as a variant while an older version is also installed
// used to drop the user's chosen variant: the older mod's attributes get
// merged into the install's `previous` info, and the variant inherited by
// upgradeExtractor overrode the one the user explicitly entered. These run
// through the real filterModInfo merge so the priority ordering and
// empty-string handling that produced the bug stay covered.
describe("attribute extractors", () => {
  beforeAll(() => {
    registerAttributeExtractor(150, attributeExtractor);
    registerAttributeExtractor(10, upgradeExtractor);
  });

  it("keeps the user-typed variant when no older mod's attributes are merged into previous (control)", async () => {
    // No-older-version path the reporter confirmed works. fullInfo.previous
    // is the trimmed shape carried over from the variant-install dialog and
    // has no `variant` key.
    const fullInfo = {
      meta: { fileVersion: "1.0.2" },
      custom: { variant: "3" },
      previous: { modId: 12345, fileId: 67890 },
    };

    const modInfo = await filterModInfo(fullInfo, undefined);

    expect(modInfo.variant).toBe("3");
  });

  it("keeps the user-typed variant when previous carries an empty-string variant from an older mod", async () => {
    // Buggy state: older mod's attributes have leaked into fullInfo.previous
    // with variant: "" (a common shape after a prior REPLACE install).
    const fullInfo = {
      meta: { fileVersion: "1.0.2" },
      custom: { variant: "3" },
      previous: { modId: 12345, fileId: 67890, variant: "" },
    };

    const modInfo = await filterModInfo(fullInfo, undefined);

    expect(modInfo.variant).toBe("3");
  });

  it("inherits previous.variant when no custom.variant is set (auto-update path)", async () => {
    // Locks in the fallback that the fix preserves: when the install
    // pipeline doesn't capture an explicit variant choice (e.g. an
    // auto-update of a same-name mod, no queryUserReplace dialog), the
    // new entry should still carry forward the prior mod's variant tag.
    const fullInfo = {
      meta: { fileVersion: "1.0.2" },
      previous: { modId: 12345, fileId: 67890, variant: "foo" },
    };

    const modInfo = await filterModInfo(fullInfo, undefined);

    expect(modInfo.variant).toBe("foo");
  });

  it("carries identity-adjacent attributes (category, customFileName, notes, icon, color) over from previous", async () => {
    // Guards against a regression where someone tweaks upgradeExtractor's
    // variant handling and accidentally drops the sibling fields it was
    // intended to preserve.
    const fullInfo = {
      meta: { fileVersion: "1.0.2" },
      previous: {
        category: "Armor",
        customFileName: "MyMod",
        notes: "user notes",
        icon: "iconA",
        color: "red",
      },
    };

    const modInfo = await filterModInfo(fullInfo, undefined);

    expect(modInfo.category).toBe("Armor");
    expect(modInfo.customFileName).toBe("MyMod");
    expect(modInfo.notes).toBe("user notes");
    expect(modInfo.icon).toBe("iconA");
    expect(modInfo.color).toBe("red");
  });
});
