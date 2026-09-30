import { describe, expect, it } from "vitest";

import { crc32, makeZip } from "./zip";

/** Walk the central directory the way an extractor does, returning the entry names it finds. */
function listEntries(zip: Buffer): string[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(offset)).toBe(0x02014b50);
    const nameLength = zip.readUInt16LE(offset + 28);
    const localOffset = zip.readUInt32LE(offset + 42);
    names.push(zip.toString("utf8", offset + 46, offset + 46 + nameLength));
    // the local header the central entry points at must carry the same name
    expect(zip.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    expect(zip.toString("utf8", localOffset + 30, localOffset + 30 + localNameLength)).toBe(
      names[i],
    );
    offset += 46 + nameLength;
  }
  return names;
}

describe("zip", () => {
  it("computes the standard crc32", () => {
    expect(crc32(Buffer.from("hello"))).toBe(0x3610a686);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it("writes a stored archive whose central directory lists every entry", () => {
    const zip = makeZip([
      { name: "a/manifest.json", data: '{"Name":"a"}' },
      { name: "a/a.dll", data: Buffer.from([1, 2, 3, 4]) },
      { name: "empty.txt", data: "" },
    ]);
    expect(listEntries(zip)).toEqual(["a/manifest.json", "a/a.dll", "empty.txt"]);
  });

  it("stores each entry's bytes verbatim after its local header", () => {
    const data = Buffer.from("payload bytes");
    const zip = makeZip([{ name: "x.bin", data }]);
    const nameLength = zip.readUInt16LE(26);
    const start = 30 + nameLength;
    expect(zip.subarray(start, start + data.length).equals(data)).toBe(true);
    expect(zip.readUInt32LE(14)).toBe(crc32(data));
    expect(zip.readUInt32LE(18)).toBe(data.length);
  });

  it("is byte-stable for the same input", () => {
    const entries = [{ name: "f", data: "same" }];
    expect(makeZip(entries).equals(makeZip(entries))).toBe(true);
  });
});
