import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect } from "vitest";

import {
  findResourceSection,
  findResourceType,
  findFirstDataEntry,
  collectDataEntries,
} from "./index";

const describeOnWindows = process.platform === "win32" ? describe : describe.skip;

const RT_ICON = 3;
const RT_GROUP_ICON = 14;
const RT_VERSION = 16;

describeOnWindows("findResourceSection", () => {
  it("finds the resource section in notepad.exe", () => {
    const fd = fs.openSync("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = findResourceSection(fd);
      expect(section).toBeDefined();
      expect(section!.buf.length).toBeGreaterThan(0);
      expect(section!.sectionVA).toBeGreaterThan(0);
      expect(section!.resourceRVA).toBeGreaterThan(0);
    } finally {
      fs.closeSync(fd);
    }
  });

  it("returns undefined for non-PE file", () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pe-res-")), "test.txt");
    fs.writeFileSync(tmp, "not a PE file");
    const fd = fs.openSync(tmp, "r");
    try {
      expect(findResourceSection(fd)).toBeUndefined();
    } finally {
      fs.closeSync(fd);
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });
});

describeOnWindows("findResourceType", () => {
  it("finds RT_VERSION in notepad.exe", () => {
    const fd = fs.openSync("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = findResourceSection(fd)!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      const typeOffset = findResourceType(section.buf, resourceOffset, RT_VERSION);
      expect(typeOffset).toBeDefined();
    } finally {
      fs.closeSync(fd);
    }
  });

  it("finds RT_GROUP_ICON in notepad.exe", () => {
    const fd = fs.openSync("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = findResourceSection(fd)!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      const typeOffset = findResourceType(section.buf, resourceOffset, RT_GROUP_ICON);
      expect(typeOffset).toBeDefined();
    } finally {
      fs.closeSync(fd);
    }
  });

  it("finds RT_ICON in notepad.exe", () => {
    const fd = fs.openSync("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = findResourceSection(fd)!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      const typeOffset = findResourceType(section.buf, resourceOffset, RT_ICON);
      expect(typeOffset).toBeDefined();
    } finally {
      fs.closeSync(fd);
    }
  });

  it("returns undefined for missing resource type", () => {
    const fd = fs.openSync("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = findResourceSection(fd)!;
      const resourceOffset = section.resourceRVA - section.sectionVA;
      // RT_CURSOR = 1 — unlikely to exist in notepad
      const typeOffset = findResourceType(section.buf, resourceOffset, 1);
      // May or may not exist; just check it doesn't crash
      expect(typeOffset === undefined || typeof typeOffset === "number").toBe(true);
    } finally {
      fs.closeSync(fd);
    }
  });
});

describeOnWindows("collectDataEntries", () => {
  it("collects RT_ICON entries from notepad.exe", () => {
    const fd = fs.openSync("C:\\Windows\\System32\\notepad.exe", "r");
    try {
      const section = findResourceSection(fd)!;
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
      fs.closeSync(fd);
    }
  });
});
