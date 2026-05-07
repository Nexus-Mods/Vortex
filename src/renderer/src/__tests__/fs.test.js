let mockData;

jest.mock("fs-extra", () => ({
  readFile: (dat) => {
    return Promise.resolve(mockData);
  },
}));

import * as fs from "../util/fs";

describe("readFileBOM", () => {
  it("supports files without BOM", () => {
    mockData = Buffer.from([0x66, 0x6f, 0x6f]);
    expect(fs.readFileBOM("")).resolves.toBe("foo");
    expect(fs.readFileBOM("", "utf8")).resolves.toBe("foo");
  });
  it("supports utf8 BOM", () => {
    mockData = Buffer.from([0xef, 0xbb, 0xbf, 0x66, 0x6f, 0x6f]);
    expect(fs.readFileBOM("")).resolves.toBe("foo");
  });
  it("supports utf16 big endian BOM", () => {
    mockData = Buffer.from([0xfe, 0xff, 0x00, 0x66, 0x00, 0x6f, 0x00, 0x6f]);
    expect(fs.readFileBOM("")).resolves.toBe("foo");
  });
  it("supports utf16 little endian BOM", () => {
    mockData = Buffer.from([0xff, 0xfe, 0x66, 0x00, 0x6f, 0x00, 0x6f, 0x00]);
    expect(fs.readFileBOM("")).resolves.toBe("foo");
  });
  it("supports utf32 big endian BOM", () => {
    mockData = Buffer.from([
      0x00, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x6f,
      0x00, 0x00, 0x00, 0x6f,
    ]);
    expect(fs.readFileBOM("")).resolves.toBe("foo");
  });
  it("supports utf32 little endian BOM", () => {
    mockData = Buffer.from([
      0xff, 0xfe, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x6f, 0x00, 0x00, 0x00,
      0x6f, 0x00, 0x00, 0x00,
    ]);
    expect(fs.readFileBOM("")).resolves.toBe("foo");
  });
});
