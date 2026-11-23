import { NexusGameDomain } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import {
  nexusFilePageUrl,
  nexusModCommentsUrl,
  nexusModFilesUrl,
  nexusModReportUrl,
  nexusModPageUrl,
  nexusSiteModPageUrl,
  withVortexSource,
} from "./nexusUrls";

const SKYRIM = NexusGameDomain("skyrimspecialedition");

describe("nexusModPageUrl", () => {
  it("is the mod's page", () => {
    expect(nexusModPageUrl(SKYRIM, 12604)).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604",
    );
  });
});

describe("nexusSiteModPageUrl", () => {
  it("is the mod's page in the site section", () => {
    expect(nexusSiteModPageUrl(2295)).toBe("https://www.nexusmods.com/site/mods/2295");
  });
});

describe("nexusFilePageUrl", () => {
  it("is the file on its mod's Files tab, offered to Vortex", () => {
    expect(nexusFilePageUrl(SKYRIM, 12604, "42")).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files&file_id=42&nmm=1",
    );
  });
});

describe("nexusModFilesUrl", () => {
  it("is the mod's Files tab", () => {
    expect(nexusModFilesUrl(SKYRIM, 12604)).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files",
    );
  });
});

describe("nexusModReportUrl", () => {
  it("is the mod's page, asking for its report dialog", () => {
    expect(nexusModReportUrl(SKYRIM, 12604)).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?report=1",
    );
  });
});

describe("nexusModCommentsUrl", () => {
  it("is the mod's Posts tab", () => {
    expect(nexusModCommentsUrl(SKYRIM, 12604)).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=posts",
    );
  });
});

describe("withVortexSource", () => {
  it("adds the feature that sent the user, and the mod's position", () => {
    expect(
      withVortexSource({ url: nexusModPageUrl(SKYRIM, 12604), feature: "browse", position: 23 }),
    ).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?source=vortex_browse&source_position=23",
    );
  });

  it("keeps the link's own parameters", () => {
    expect(
      withVortexSource({ url: nexusFilePageUrl(SKYRIM, 12604, "42"), feature: "health_check" }),
    ).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files&file_id=42&nmm=1&source=vortex_health_check",
    );
  });
});
