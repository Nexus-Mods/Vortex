import { expect, it, describe } from "vitest";

import getKnownFolders from "./knownfolders";

describe("knownfolders", () => {
  it("returns the right shape for a known game and an unknown one", () => {
    const validResult = getKnownFolders("starfield", {});
    const invalidResult = getKnownFolders("unknownGame", {});

    expect(invalidResult).toBeUndefined();
    expect(Object.keys(validResult)).toEqual(["starfield-mygames"]);
  });
});
