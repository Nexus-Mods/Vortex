import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, it, expect } from "vitest";

import { makeFileInfo } from "../../../test-utils/builders";
import type { IDownload } from "../types/IDownload";
import {
  TEMP_DOWNLOAD_PREFIX,
  freeDownloadName,
  friendlyDownloadName,
  isTempDownloadName,
  nameFromUrl,
} from "./downloadNames";

const tempName = `${TEMP_DOWNLOAD_PREFIX}00000001`;

const nxmUrl = "nxm://examplegame/mods/123/files/456?key=EXAMPLEKEY&expires=1700000000&user_id=1";
const cdnUrl =
  "https://cdn.example-cdn.com/100/123/Example Mod Name-123-1-0.7z?expires=1700000000&md5=EXAMPLEMD5&user_id=1";

// friendlyDownloadName only reads a handful of fields; cast partial fixtures.
const download = (props: Partial<IDownload>): IDownload => props as IDownload;

describe("isTempDownloadName", () => {
  it("recognises the temporary placeholder name", () => {
    expect(isTempDownloadName(tempName)).toBe(true);
  });

  it("treats a real file name as non-temporary", () => {
    expect(isTempDownloadName("My File.zip")).toBe(false);
  });

  it("is false for undefined", () => {
    expect(isTempDownloadName(undefined)).toBe(false);
  });
});

describe("nameFromUrl", () => {
  it("returns the basename of a URL path", () => {
    expect(nameFromUrl("https://example.com/files/My%20File.zip")).toBe("My File.zip");
  });

  it("decodes percent-encoded spaces", () => {
    expect(nameFromUrl("https://example.com/a/b/mod%20patch.7z")).toBe("mod patch.7z");
  });

  it("returns undefined for undefined input", () => {
    expect(nameFromUrl(undefined)).toBeUndefined();
  });

  it("returns undefined for an unparseable URL", () => {
    expect(nameFromUrl("not a url")).toBeUndefined();
  });

  it("extracts the file name from a resolved Nexus CDN URL (spaces + query string)", () => {
    expect(nameFromUrl(cdnUrl)).toBe("Example Mod Name-123-1-0.7z");
  });

  it("returns only the file id for an nxm link (no useful name)", () => {
    expect(nameFromUrl(nxmUrl)).toBe("456");
  });
});

describe("friendlyDownloadName", () => {
  it("uses the real on-disk name once it's known", () => {
    expect(friendlyDownloadName(download({ localPath: "My File.zip" }))).toBe("My File.zip");
  });

  it("prefers modInfo.name while the temp name is still in use", () => {
    const result = friendlyDownloadName(
      download({ localPath: tempName, modInfo: { name: "Cool Mod" } }),
    );
    expect(result).toBe("Cool Mod");
  });

  it("falls back to meta.logicalFileName when there's no modInfo.name", () => {
    const result = friendlyDownloadName(
      download({ localPath: tempName, modInfo: { meta: { logicalFileName: "Logical Name" } } }),
    );
    expect(result).toBe("Logical Name");
  });

  it("falls back to meta.fileName when there's no logical name", () => {
    const result = friendlyDownloadName(
      download({ localPath: tempName, modInfo: { meta: { fileName: "actual-file.zip" } } }),
    );
    expect(result).toBe("actual-file.zip");
  });

  it("falls back to the resolved nexus file info name", () => {
    const result = friendlyDownloadName(
      download({
        localPath: tempName,
        modInfo: { nexus: { fileInfo: makeFileInfo({ name: "Nexus File" }) } },
      }),
    );
    expect(result).toBe("Nexus File");
  });

  it("falls back to the URL basename when no metadata is available", () => {
    const result = friendlyDownloadName(
      download({ localPath: tempName, urls: ["https://example.com/files/from-url.7z"] }),
    );
    expect(result).toBe("from-url.7z");
  });

  it("returns the temp name as a last resort", () => {
    expect(friendlyDownloadName(download({ localPath: tempName }))).toBe(tempName);
  });

  it("prefers a real localPath over any metadata", () => {
    const result = friendlyDownloadName(
      download({ localPath: "final.zip", modInfo: { name: "Cool Mod" } }),
    );
    expect(result).toBe("final.zip");
  });

  it("uses resolved metadata over the nxm link for a pending nxm download", () => {
    const result = friendlyDownloadName(
      download({
        localPath: tempName,
        urls: [nxmUrl],
        modInfo: { meta: { logicalFileName: "Example Mod Name" } },
      }),
    );
    expect(result).toBe("Example Mod Name");
  });

  it("falls back to the nxm file id when a pending nxm download has no metadata yet", () => {
    const result = friendlyDownloadName(download({ localPath: tempName, urls: [nxmUrl] }));
    expect(result).toBe("456");
  });

  it("prefers modInfo.name over meta.logicalFileName", () => {
    const result = friendlyDownloadName(
      download({
        localPath: tempName,
        modInfo: { name: "Cool Mod", meta: { logicalFileName: "Logical Name" } },
      }),
    );
    expect(result).toBe("Cool Mod");
  });
});

describe("freeDownloadName", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "vortex-dl-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns the name unchanged when nothing collides", async () => {
    expect(await freeDownloadName(dir, "Mod.7z")).toBe("Mod.7z");
  });

  it("inserts a timestamp before the extension when the name is taken", async () => {
    await writeFile(path.join(dir, "Mod.7z"), "x");
    const name = await freeDownloadName(dir, "Mod.7z");
    expect(name).not.toBe("Mod.7z");
    expect(name).toMatch(/^Mod\.\d+\.7z$/);
  });

  it("appends the timestamp when a name has no extension", async () => {
    await writeFile(path.join(dir, "README"), "x");
    const name = await freeDownloadName(dir, "README");
    expect(name).toMatch(/^README\.\d+$/);
  });
});
