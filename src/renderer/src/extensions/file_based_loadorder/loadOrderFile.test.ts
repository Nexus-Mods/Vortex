import { describe, expect, it } from "vitest";

import { makeLoadOrder } from "../../test-utils/builders";
import {
  type ILoadOrderFile,
  importedFromOtherLoadOrder,
  LOAD_ORDER_FILE_VERSION,
  parseLoadOrderFile,
  serializeLoadOrderFile,
} from "./loadOrderFile";
import { DEFAULT_LOAD_ORDER_ID } from "./types/types";

describe("serializeLoadOrderFile", () => {
  it("writes the version, the load order id and the entries", () => {
    const entries = makeLoadOrder("a.pak", "b.pak");

    expect(JSON.parse(serializeLoadOrderFile("redmod", entries))).toEqual({
      version: LOAD_ORDER_FILE_VERSION,
      loadOrderId: "redmod",
      entries,
    });
  });

  it("names the primary load order by its default id", () => {
    const parsed = parseLoadOrderFile(serializeLoadOrderFile(undefined, makeLoadOrder("a.pak")));

    expect(parsed.loadOrderId).toBe(DEFAULT_LOAD_ORDER_ID);
  });
});

describe("parseLoadOrderFile", () => {
  it("reads back what was exported", () => {
    const entries = makeLoadOrder("a.pak", "b.pak");

    expect(parseLoadOrderFile(serializeLoadOrderFile("redmod", entries))).toEqual({
      version: LOAD_ORDER_FILE_VERSION,
      loadOrderId: "redmod",
      entries,
    });
  });

  it("reads a file saved with a byte order mark", () => {
    const entries = makeLoadOrder("a.pak");

    const byteOrderMark = String.fromCharCode(0xfeff);

    expect(parseLoadOrderFile(byteOrderMark + serializeLoadOrderFile("redmod", entries))).toEqual({
      version: LOAD_ORDER_FILE_VERSION,
      loadOrderId: "redmod",
      entries,
    });
  });

  it("keeps the keys a game extension adds to an entry", () => {
    const entries = makeLoadOrder("a.pak").map((entry) => ({ ...entry, priority: 3 }));

    expect(parseLoadOrderFile(JSON.stringify(entries)).entries).toEqual(entries);
  });

  it("reads a bare list as entries of no particular load order", () => {
    const entries = makeLoadOrder("a.pak", "b.pak");

    expect(parseLoadOrderFile(JSON.stringify(entries))).toEqual({
      version: LOAD_ORDER_FILE_VERSION,
      entries,
    });
  });

  it.for<[string, unknown]>([
    ["an unknown version", { version: LOAD_ORDER_FILE_VERSION + 1, loadOrderId: "x", entries: [] }],
    [
      "entries that are not a list",
      { version: LOAD_ORDER_FILE_VERSION, loadOrderId: "x", entries: "a" },
    ],
    ["a list entry without an id", [{ name: "a", enabled: true }]],
    ["a bare string", "a.pak"],
  ])("rejects %s", ([, fileData]) => {
    expect(() => parseLoadOrderFile(JSON.stringify(fileData))).toThrow("invalid load order file");
  });
});

describe("importedFromOtherLoadOrder", () => {
  it.for<[string, string | undefined, string | undefined, boolean]>([
    ["accepts a bare list into any load order", undefined, "redmod", false],
    ["accepts the primary's file into the primary", DEFAULT_LOAD_ORDER_ID, undefined, false],
    ["accepts a named load order's file into that load order", "redmod", "redmod", false],
    ["flags a named load order's file imported into the primary", "redmod", undefined, true],
  ])("%s", ([, fileLoadOrderId, targetLoadOrderId, expected]) => {
    const file: ILoadOrderFile = {
      version: LOAD_ORDER_FILE_VERSION,
      loadOrderId: fileLoadOrderId,
      entries: makeLoadOrder("a.pak"),
    };

    expect(importedFromOtherLoadOrder(file, targetLoadOrderId)).toBe(expected);
  });
});
