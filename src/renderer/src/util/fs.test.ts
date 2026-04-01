import { describe, it, expect, vi } from "vitest";

let mockData: Buffer;

vi.mock("fs-extra", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  // fs-extra is CJS, so named exports may be on the default export
  const base = (actual.default ?? actual) as Record<string, unknown>;
  return {
    ...base,
    default: {
      ...base,
      readFile: (...args: unknown[]) => {
        if (args.length <= 1 || typeof args[args.length - 1] !== "function") {
          return Promise.resolve(mockData);
        }
        // callback style
        (args[args.length - 1] as (err: null, data: Buffer) => void)(
          null,
          mockData,
        );
      },
    },
    readFile: (...args: unknown[]) => {
      if (args.length <= 1 || typeof args[args.length - 1] !== "function") {
        return Promise.resolve(mockData);
      }
      (args[args.length - 1] as (err: null, data: Buffer) => void)(
        null,
        mockData,
      );
    },
  };
});

import * as fs from "./fs";

describe("readFileBOM", () => {
  it("supports files without BOM", async () => {
    mockData = Buffer.from([0x66, 0x6f, 0x6f]);
    await expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
    await expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
  });
  it("supports utf8 BOM", async () => {
    mockData = Buffer.from([0xef, 0xbb, 0xbf, 0x66, 0x6f, 0x6f]);
    await expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
  });
  it("supports utf16 big endian BOM", async () => {
    mockData = Buffer.from([0xfe, 0xff, 0x00, 0x66, 0x00, 0x6f, 0x00, 0x6f]);
    await expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
  });
  it("supports utf16 little endian BOM", async () => {
    mockData = Buffer.from([0xff, 0xfe, 0x66, 0x00, 0x6f, 0x00, 0x6f, 0x00]);
    await expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
  });
  it("supports utf32 big endian BOM", async () => {
    mockData = Buffer.from([
      0x00, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x6f,
      0x00, 0x00, 0x00, 0x6f,
    ]);
    await expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
  });
  it("supports utf32 little endian BOM", async () => {
    mockData = Buffer.from([
      0xff, 0xfe, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x6f, 0x00, 0x00, 0x00,
      0x6f, 0x00, 0x00, 0x00,
    ]);
    await expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
  });
});
