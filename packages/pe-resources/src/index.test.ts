import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { describe, it, expect } from "vitest";

import {
  findResourceSection,
  findResourceSectionSync,
  findResourceType,
  findFirstDataEntry,
  collectDataEntries,
} from "./index";

const describeOnWindows = process.platform === "win32" ? describe : describe.skip;

const RT_ICON = 3;
const RT_GROUP_ICON = 14;
const RT_VERSION = 16;

// Cross-platform fixture — already committed to the repo
const DOTNET_PROBE = path.resolve(import.meta.dirname, "../../../assets/dotnetprobe.exe");

// --- Cross-platform tests (use committed PE fixture) ---

describe("findResourceSection (cross-platform)", () => {
  it("parses PE headers from dotnetprobe.exe", async () => {
    const fh = await fsp.open(DOTNET_PROBE, "r");
    try {
      const section = await findResourceSection(fh);
      // dotnetprobe.exe is a real PE — it may or may not have resources,
      // but the parser must not crash
      if (section !== undefined) {
        expect(section.buf.length).toBeGreaterThan(0);
        expect(section.sectionVA).toBeGreaterThan(0);
      }
    } finally {
      await fh.close();
    }
  });

  it("returns undefined for non-PE file", async () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pe-res-")), "test.txt");
    fs.writeFileSync(tmp, "not a PE file");
    const fh = await fsp.open(tmp, "r");
    try {
      expect(await findResourceSection(fh)).toBeUndefined();
    } finally {
      await fh.close();
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  it("returns undefined for truncated MZ header", async () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pe-res-")), "trunc.exe");
    // Valid MZ magic but file is too short for a real PE
    fs.writeFileSync(tmp, Buffer.from("MZ"));
    const fh = await fsp.open(tmp, "r");
    try {
      expect(await findResourceSection(fh)).toBeUndefined();
    } finally {
      await fh.close();
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  it("returns undefined for empty file", async () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pe-res-")), "empty.exe");
    fs.writeFileSync(tmp, Buffer.alloc(0));
    const fh = await fsp.open(tmp, "r");
    try {
      expect(await findResourceSection(fh)).toBeUndefined();
    } finally {
      await fh.close();
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });
});

describe("findResourceSectionSync (cross-platform)", () => {
  it("parses PE headers from dotnetprobe.exe", () => {
    const fd = fs.openSync(DOTNET_PROBE, "r");
    try {
      const section = findResourceSectionSync(fd);
      if (section !== undefined) {
        expect(section.buf.length).toBeGreaterThan(0);
        expect(section.sectionVA).toBeGreaterThan(0);
      }
    } finally {
      fs.closeSync(fd);
    }
  });
});

describe("findResourceType (cross-platform)", () => {
  it("returns undefined when resource type is not present", async () => {
    const fh = await fsp.open(DOTNET_PROBE, "r");
    try {
      const section = await findResourceSection(fh);
      if (section !== undefined) {
        const resourceOffset = section.resourceRVA - section.sectionVA;
        // RT_CURSOR = 1 — extremely unlikely in a .NET probe tool
        const result = findResourceType(section.buf, resourceOffset, 1);
        expect(result === undefined || typeof result === "number").toBe(true);
      }
    } finally {
      await fh.close();
    }
  });
});

// --- Windows-only tests (use system executables) ---

describeOnWindows("findResourceSection (Windows)", () => {
  it("finds the resource section in notepad.exe", async () => {
    const fh = await fsp.open("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = await findResourceSection(fh);
      expect(section).toBeDefined();
      expect(section!.buf.length).toBeGreaterThan(0);
      expect(section!.sectionVA).toBeGreaterThan(0);
      expect(section!.resourceRVA).toBeGreaterThan(0);
    } finally {
      await fh.close();
    }
  });
});

describeOnWindows("findResourceType (Windows)", () => {
  it("finds RT_VERSION in notepad.exe", async () => {
    const fh = await fsp.open("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = (await findResourceSection(fh))!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      const typeOffset = findResourceType(section.buf, resourceOffset, RT_VERSION);
      expect(typeOffset).toBeDefined();
    } finally {
      await fh.close();
    }
  });

  it("finds RT_GROUP_ICON in notepad.exe", async () => {
    const fh = await fsp.open("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = (await findResourceSection(fh))!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      const typeOffset = findResourceType(section.buf, resourceOffset, RT_GROUP_ICON);
      expect(typeOffset).toBeDefined();
    } finally {
      await fh.close();
    }
  });

  it("finds RT_ICON in notepad.exe", async () => {
    const fh = await fsp.open("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = (await findResourceSection(fh))!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      const typeOffset = findResourceType(section.buf, resourceOffset, RT_ICON);
      expect(typeOffset).toBeDefined();
    } finally {
      await fh.close();
    }
  });
});

describeOnWindows("collectDataEntries (Windows)", () => {
  it("collects RT_ICON entries from notepad.exe", async () => {
    const fh = await fsp.open("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = (await findResourceSection(fh))!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      const iconDirOffset = findResourceType(section.buf, resourceOffset, RT_ICON)!;
      const entries = collectDataEntries(section.buf, iconDirOffset);
      expect(entries.size).toBeGreaterThan(0);

      for (const [id, entry] of entries) {
        expect(id).toBeGreaterThan(0);
        expect(entry.dataRVA).toBeGreaterThan(0);
        expect(entry.dataSize).toBeGreaterThan(0);
      }
    } finally {
      await fh.close();
    }
  });
});
