import { describe, expect, it } from "vitest";

import { redactArgvForLog, redactUrlForLog } from "./redactUrl";

describe("redactUrlForLog", () => {
  it("redacts the query values of an nxm link but keeps its path and expiry", () => {
    expect(
      redactUrlForLog(
        "nxm://skyrimspecialedition/mods/266/files/1000?key=K3yAbC-12&expires=1700000000&user_id=42",
      ),
    ).toBe(
      "nxm://skyrimspecialedition/mods/266/files/1000?key=<redacted>&expires=1700000000&user_id=<redacted>",
    );
  });

  it("redacts a signature made only of letters", () => {
    expect(
      redactUrlForLog(
        "https://cf-files.nexusmods.com/cdn/1704/266/file.7z?md5=AbCdEfGhIjKlMnOpQrStUv&expires=1700000000",
      ),
    ).toBe("https://cf-files.nexusmods.com/cdn/1704/266/file.7z?md5=<redacted>&expires=1700000000");
  });

  it("redacts bare query entries and keeps empty values", () => {
    expect(redactUrlForLog("https://example.com/x?secrettoken&a=&uid=123")).toBe(
      "https://example.com/x?<redacted>&a=&uid=<redacted>",
    );
  });

  it("redacts the whole fragment, including one with its own query", () => {
    expect(redactUrlForLog("https://example.com/#/cb?code=abcdef&state=xyz")).toBe(
      "https://example.com/#<redacted>",
    );
    expect(redactUrlForLog(new URL("https://example.com/docs#"))).toBe("https://example.com/docs#");
  });

  it("drops user:password@, even when the password contains ? or #", () => {
    expect(redactUrlForLog("http://jane:p@ss@proxy.local:8080/x")).toBe(
      "http://<redacted>@proxy.local:8080/x",
    );
    expect(redactUrlForLog("http://jane:pa?s#s@proxy.local:8080/x")).toBe(
      "http://<redacted>@proxy.local:8080/x",
    );
  });

  it("keeps a URL without query or fragment and passes undefined through", () => {
    expect(
      redactUrlForLog(new URL("https://www.nexusmods.com/skyrimspecialedition/mods/266")),
    ).toBe("https://www.nexusmods.com/skyrimspecialedition/mods/266");
    expect(redactUrlForLog(undefined)).toBeUndefined();
    expect(redactUrlForLog("")).toBe("");
  });
});

describe("redactArgvForLog", () => {
  it("redacts the URLs in arguments and leaves the rest", () => {
    expect(
      redactArgvForLog([
        "Vortex.exe",
        "--download",
        "nxm://skyrimse/mods/1/files/2?key=K3yAbC-12&expires=17",
        "--user-data=C:\\data",
      ]),
    ).toEqual([
      "Vortex.exe",
      "--download",
      "nxm://skyrimse/mods/1/files/2?key=<redacted>&expires=17",
      "--user-data=C:\\data",
    ]);
  });

  it("redacts Epic credentials in both switch forms", () => {
    expect(
      redactArgvForLog([
        "Vortex.exe",
        "-AUTH_LOGIN=unused",
        "-AUTH_PASSWORD=0123abcd",
        "-AUTH_TYPE=exchangecode",
        "-epicusername=Jane",
        "--epic-userid",
        "abc",
      ]),
    ).toEqual([
      "Vortex.exe",
      "-AUTH_LOGIN=<redacted>",
      "-AUTH_PASSWORD=<redacted>",
      "-AUTH_TYPE=exchangecode",
      "-epicusername=<redacted>",
      "--epic-userid",
      "<redacted>",
    ]);
  });

  it("keeps trailing punctuation outside a URL", () => {
    expect(redactArgvForLog(["(see https://example.com/a?sig=Zk3x)."])).toEqual([
      "(see https://example.com/a?sig=<redacted>).",
    ]);
  });
});
