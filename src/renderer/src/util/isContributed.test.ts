import { describe, expect, it } from "vitest";

import { COMPANY_ID, NEXUSMODS_EXT_ID } from "./constants";
import { isContributed } from "./isContributed";

describe("isContributed", () => {
  it.each([COMPANY_ID, NEXUSMODS_EXT_ID])("treats %s as official", (author) => {
    expect(isContributed(author)).toBe(false);
  });

  it.each([undefined, ""])("treats %s as official", (author) => {
    expect(isContributed(author)).toBe(false);
  });

  // How the extensions actually spell it, Cyberpunk 2077's among them.
  it.each(["NexusMods", "nexusmods", "NEXUS MODS", "BlackTreeGamingLtd."])(
    "treats %s as official however it is spelled",
    (author) => {
      expect(isContributed(author)).toBe(false);
    },
  );

  // Ours is matched whole, so a name that merely contains it is still a contributor.
  it.each(["ArchonStormNexus", "NexusModsCaretaker"])("treats %s as contributed", (author) => {
    expect(isContributed(author)).toBe(true);
  });

  // Matched whole, so a collaboration is its own name and stays community.
  it.each([
    "Dimenarius",
    "nelson3219 & Senjay",
    "Homonoia Studios Ltd.",
    `${COMPANY_ID} & AncientGrief`,
  ])("treats %s as contributed", (author) => {
    expect(isContributed(author)).toBe(true);
  });
});
