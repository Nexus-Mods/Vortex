import { describe, expect, it } from "vitest";

import { modThumbnailUrl } from "./modThumbnailUrl";

const NESTED = "https://staticdelivery.nexusmods.com/mods/1704/images/162153/162153-1760964400.jpg";
const FLAT = "https://staticdelivery.nexusmods.com/mods/1704/images/12345-1500000000.png";
const ELSEWHERE = "https://media.nexusmods.com/4/2/42f2332d.webp";

describe("modThumbnailUrl", () => {
  it("points a picture under a mod's own folder at its thumbnail", () => {
    expect(modThumbnailUrl(NESTED)).toBe(
      "https://staticdelivery.nexusmods.com/mods/1704/images/thumbnails/162153/162153-1760964400.jpg",
    );
  });

  it("points a picture straight under images at its thumbnail", () => {
    expect(modThumbnailUrl(FLAT)).toBe(
      "https://staticdelivery.nexusmods.com/mods/1704/images/thumbnails/12345-1500000000.png",
    );
  });

  it("leaves a thumbnail as it is", () => {
    const thumbnail = modThumbnailUrl(NESTED);

    expect(modThumbnailUrl(thumbnail)).toBe(thumbnail);
  });

  it("has none for a picture from elsewhere", () => {
    expect(modThumbnailUrl(ELSEWHERE)).toBeUndefined();
  });

  it("has none for a mod without a picture", () => {
    expect(modThumbnailUrl(undefined)).toBeUndefined();
  });
});
