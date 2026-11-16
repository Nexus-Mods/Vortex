import { describe, expect, it } from "vitest";

import { isModDetailsTab, MOD_DETAILS_TABS } from "./modDetailsTab";

describe("isModDetailsTab", () => {
  it.each(MOD_DETAILS_TABS)("takes %s as a tab of a mod's details", (tab) => {
    expect(isModDetailsTab(tab)).toBe(true);
  });

  it("turns away a panel id that isn't one of them", () => {
    expect(isModDetailsTab("files")).toBe(false);
  });
});
