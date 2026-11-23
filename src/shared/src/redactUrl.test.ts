import { describe, expect, it } from "vitest";

import { redactUrlForLog, redactUrlsInText } from "./redactUrl";

describe("redactUrlForLog", () => {
  it("redacts the key and user of an nxm link but keeps what identifies it", () => {
    expect(
      redactUrlForLog(
        "nxm://skyrimspecialedition/mods/266/files/1000?key=K3yAbC-12&expires=1700000000&user_id=42",
      ),
    ).toBe(
      "nxm://skyrimspecialedition/mods/266/files/1000?key=<redacted>&expires=1700000000&user_id=<redacted>",
    );
  });

  it("redacts the signature of a signed download link and keeps its expiry", () => {
    expect(
      redactUrlForLog(
        "https://cf-files.nexusmods.com/cdn/1704/266/file.7z?md5=Zk3xQ9aLmN0pRs&expires=1700000000&user_id=42",
      ),
    ).toBe(
      "https://cf-files.nexusmods.com/cdn/1704/266/file.7z?md5=<redacted>&expires=1700000000&user_id=<redacted>",
    );
  });

  it("redacts a presigned upload URL but keeps the parameter names", () => {
    expect(
      redactUrlForLog(
        "https://bucket.s3.amazonaws.com/up/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=abcdef0123456789",
      ),
    ).toBe(
      "https://bucket.s3.amazonaws.com/up/file?X-Amz-Algorithm=<redacted>&X-Amz-Expires=900&X-Amz-Signature=<redacted>",
    );
  });

  it("keeps the query of an ordinary page link", () => {
    const url = "https://www.nexusmods.com/skyrimspecialedition/mods/266?tab=files&file_id=1000";
    expect(redactUrlForLog(url)).toBe(url);
  });

  it("redacts a plain-looking value under a credential name", () => {
    expect(redactUrlForLog("https://example.com/cb?code=abcdef&state=xyz")).toBe(
      "https://example.com/cb?code=<redacted>&state=<redacted>",
    );
  });

  it("redacts credential-shaped values under names it doesn't know", () => {
    // Guards the value check on its own: none of these names are in the sensitive list, so
    // loosening what counts as a plain value would make this fail rather than leak.
    expect(
      redactUrlForLog(
        "https://example.com/x?a=K3yAbC-12xyz&b=Zk3xQ9aLmN0pRs&c=3f2a9c0d8e7b6a5f4e3d2c1b0a9f8e7d&d=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl&e=jane@example.com",
      ),
    ).toBe(
      "https://example.com/x?a=<redacted>&b=<redacted>&c=<redacted>&d=<redacted>&e=<redacted>",
    );
  });

  it("redacts credentials and a token in the fragment", () => {
    expect(redactUrlForLog("http://jane:p@ss@proxy.local:8080/x#access_token=abc123")).toBe(
      "http://<redacted>@proxy.local:8080/x#access_token=<redacted>",
    );
  });

  it("keeps a plain fragment and takes a URL object", () => {
    expect(redactUrlForLog(new URL("https://example.com/docs#install"))).toBe(
      "https://example.com/docs#install",
    );
  });

  it("handles text that isn't a URL", () => {
    expect(redactUrlForLog("not a url ?key=K3yAbC-12")).toBe("not a url ?key=<redacted>");
    expect(redactUrlForLog("")).toBe("");
  });
});

describe("redactUrlsInText", () => {
  it("redacts the links in a command line and leaves the rest", () => {
    expect(
      redactUrlsInText(
        'Vortex.exe --download "nxm://skyrimse/mods/1/files/2?key=K3yAbC-12&expires=17" --game skyrimse',
      ),
    ).toBe(
      'Vortex.exe --download "nxm://skyrimse/mods/1/files/2?key=<redacted>&expires=17" --game skyrimse',
    );
  });

  it("keeps trailing punctuation outside the URL", () => {
    expect(redactUrlsInText("(see https://example.com/a?sig=Zk3xQ9aLmN0p).")).toBe(
      "(see https://example.com/a?sig=<redacted>).",
    );
  });

  it("leaves text without a URL alone", () => {
    const text = "C:\\Program Files\\Vortex\\Vortex.exe --user-data=C:\\data";
    expect(redactUrlsInText(text)).toBe(text);
  });
});
