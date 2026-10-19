import { describe, expect, it } from "vitest";

import type { IDetectedGame } from "../../types/IDetectedGame";
import { detectedStore } from "./detectedStore";

// Listings in the shapes collectListings sends: Steam and GOG ids, and Epic's namespace:item.
const STEAM = ["489830"];
const GOG = ["1711230643"];
const EPIC = ["catalognamespace:catalogitem"];

const matchedOn = (storeIDs: Partial<IDetectedGame["storeIDs"]>): IDetectedGame => ({
  gameUid: "uid-1704",
  gameId: 1704,
  storeIDs: { steam: [], gog: [], epic: [], ...storeIDs },
});

describe("detectedStore", () => {
  it("names the store the game matched on", () => {
    expect(detectedStore(matchedOn({ steam: STEAM }))).toBe("steam");
    expect(detectedStore(matchedOn({ gog: GOG }))).toBe("gog");
    expect(detectedStore(matchedOn({ epic: EPIC }))).toBe("epic");
  });

  // Steam, then Epic, then GOG: the order findByAppId walks the stores in.
  it("picks from several stores the way most discovery does", () => {
    expect(detectedStore(matchedOn({ steam: STEAM, gog: GOG, epic: EPIC }))).toBe("steam");
    expect(detectedStore(matchedOn({ gog: GOG, epic: EPIC }))).toBe("epic");
  });

  it("names none when the game matched no store", () => {
    expect(detectedStore(matchedOn({}))).toBeUndefined();
  });
});
