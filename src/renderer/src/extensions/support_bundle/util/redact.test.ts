import { describe, expect, it } from "vitest";

import { hasNonAscii, redactSensitiveText, redactSignedUrls, redactUserPaths } from "./redact";

describe("redactUserPaths", () => {
  it.each([
    [
      "raw backslashes",
      "C:\\Users\\bob\\AppData\\Roaming\\Vortex",
      "C:\\Users\\<USER>\\AppData\\Roaming\\Vortex",
    ],
    [
      "JSON-escaped backslashes",
      '{"path":"C:\\\\Users\\\\bob\\\\AppData\\\\Roaming"}',
      '{"path":"C:\\\\Users\\\\<USER>\\\\AppData\\\\Roaming"}',
    ],
    ["forward slashes", "C:/Users/bob/Games", "C:/Users/<USER>/Games"],
    ["lower-case drive", "d:\\users\\bob\\x", "d:\\users\\<USER>\\x"],
    ["a name with spaces and dots", "C:\\Users\\Bob Smith.Jr\\x", "C:\\Users\\<USER>\\x"],
    [
      "macOS",
      "/Users/bob/Library/Application Support",
      "/Users/<USER>/Library/Application Support",
    ],
    ["Linux", "/home/bob/.config/Vortex", "/home/<USER>/.config/Vortex"],
    ["the bare profile folder", "C:\\Users\\bob", "C:\\Users\\<USER>"],
  ])("redacts the username (%s)", (_label, input, expected) => {
    expect(redactUserPaths(input)).toBe(expected);
  });

  it("leaves paths outside a user profile alone", () => {
    const text = "D:\\Games\\Steam\\steamapps\\common\\Skyrim Special Edition\\Data";
    expect(redactUserPaths(text)).toBe(text);
  });

  it("is idempotent", () => {
    const once = redactUserPaths("C:\\Users\\bob\\x and /home/bob/y");
    expect(redactUserPaths(once)).toBe(once);
  });
});

describe("redactSignedUrls", () => {
  it("blanks the Nexus CDN access token but keeps host, file, expiry and user", () => {
    const url =
      "https://cf-files.nexusmods.com/cdn/1704/25143/FTF_Core-25143-3-1-1589675265.zip?expires=1788376683&md5=AbC123-_xyz&user_id=259727278";

    expect(redactSignedUrls(url)).toBe(
      "https://cf-files.nexusmods.com/cdn/1704/25143/FTF_Core-25143-3-1-1589675265.zip?expires=1788376683&md5=REDACTED&user_id=259727278",
    );
  });

  it("blanks the key on an nxm link", () => {
    expect(
      redactSignedUrls("nxm://baldursgate3/mods/15626/files/100201?key=s3cret&expires=1&user_id=2"),
    ).toBe("nxm://baldursgate3/mods/15626/files/100201?key=REDACTED&expires=1&user_id=2");
  });

  it("blanks the SAS signature and jwt on a GitHub release asset link", () => {
    const url =
      "https://release-assets.githubusercontent.com/x/y?sp=r&sv=2018-11-09&sig=abc%2Bdef&jwt=eyJhbGciOi.payload.sig&response-content-type=application%2Foctet-stream";

    expect(redactSignedUrls(url)).toBe(
      "https://release-assets.githubusercontent.com/x/y?sp=r&sv=2018-11-09&sig=REDACTED&jwt=REDACTED&response-content-type=application%2Foctet-stream",
    );
  });

  it("does not touch a parameter that merely ends in key", () => {
    expect(redactSignedUrls("https://x/y?monkey=banana&apikey=abc")).toBe(
      "https://x/y?monkey=banana&apikey=REDACTED",
    );
  });

  it("stops at a JSON string boundary", () => {
    expect(redactSignedUrls('{"url":"https://x/y?key=abc","next":1}')).toBe(
      '{"url":"https://x/y?key=REDACTED","next":1}',
    );
  });
});

describe("redactSensitiveText", () => {
  it("applies both rules to a log line", () => {
    const line =
      '2026-09-15T07:19:31.257Z [DEBG] [RENDERER] starting download {"url":"https://cf-files.nexusmods.com/a.7z?expires=1&md5=t0k3n&user_id=2","dest":"C:\\\\Users\\\\bob\\\\Downloads"}';

    expect(redactSensitiveText(line)).toBe(
      '2026-09-15T07:19:31.257Z [DEBG] [RENDERER] starting download {"url":"https://cf-files.nexusmods.com/a.7z?expires=1&md5=REDACTED&user_id=2","dest":"C:\\\\Users\\\\<USER>\\\\Downloads"}',
    );
  });
});

describe("hasNonAscii", () => {
  it("flags accented and non-Latin names and nothing else", () => {
    expect(hasNonAscii("C:\\Users\\bob")).toBe(false);
    expect(hasNonAscii("C:\\Users\\Zoë")).toBe(true);
    expect(hasNonAscii("C:\\Users\\Ярослав")).toBe(true);
  });
});
