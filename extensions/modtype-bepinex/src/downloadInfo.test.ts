import { describe, expect, it } from "vitest";
// Regression test for https://github.com/Nexus-Mods/Vortex/issues/21979
//
// An md5 lookup is game-agnostic. When another author has re-uploaded a
// byte-identical BepInEx to a mod page, the lookup matches that foreign record and
// core's queryDLInfo would stamp `source: 'nexus'` plus the foreign mod/file/game
// ids onto the download. The GitHub route defends against this by declaring where
// the file actually came from; core's #21979 guard then keeps the md5 metadata but
// leaves the declared source alone.

import { buildGithubDownloadInfo } from "./downloadInfo";

describe("buildGithubDownloadInfo", () => {
  it("declares a non-Nexus source, so core's #21979 guard skips the md5 stamp", () => {
    const info = buildGithubDownloadInfo("hollowknightsilksong");
    // the exact predicate queryDLInfo gates on
    expect(info.source !== undefined && info.source !== "nexus").toBe(true);
  });

  it("declares the 'website' source specifically (a registered mod source id)", () => {
    expect(buildGithubDownloadInfo("hollowknightsilksong").source).toBe("website");
  });

  it("files the download under the game it was requested for", () => {
    expect(buildGithubDownloadInfo("subnautica").game).toBe("subnautica");
  });
});
