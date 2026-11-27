import { describe, expect, it } from "vitest";

import { downloadSourceOf, vortexLinkSource, websiteDownloadSource } from "./downloadSource";

describe("vortexLinkSource", () => {
  it("names the feature for the website", () => {
    expect(vortexLinkSource("browse")).toBe("vortex_browse");
    expect(vortexLinkSource("health_check")).toBe("vortex_health_check");
  });
});

describe("websiteDownloadSource", () => {
  it("is the feature's website source for a link Vortex sent the user from", () => {
    expect(websiteDownloadSource("vortex_browse")).toBe("browse_website");
    expect(websiteDownloadSource("vortex_health_check")).toBe("health_check_website");
  });

  it("is undefined for a link without a Vortex source", () => {
    expect(websiteDownloadSource(undefined)).toBeUndefined();
    expect(websiteDownloadSource("homepage")).toBeUndefined();
  });
});

describe("downloadSourceOf", () => {
  it("is the source saved on the download", () => {
    expect(downloadSourceOf({ downloadSource: "browse" })).toBe("browse");
    expect(downloadSourceOf({ downloadSource: "health_check_website" })).toBe(
      "health_check_website",
    );
  });

  it("is null for a download without a known source", () => {
    expect(downloadSourceOf(undefined)).toBeNull();
    expect(downloadSourceOf({})).toBeNull();
    expect(downloadSourceOf({ downloadSource: "elsewhere" })).toBeNull();
  });
});
