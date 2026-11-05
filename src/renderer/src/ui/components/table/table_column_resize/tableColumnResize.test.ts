import { describe, expect, it } from "vitest";

import {
  columnTrack,
  columnTracks,
  DEFAULT_COLUMN_WIDTH,
  isResizable,
  keptWidth,
  minColumnWidth,
} from "./tableColumnResize";

describe("minColumnWidth", () => {
  it("is a fixed column's width", () => {
    expect(minColumnWidth({ width: "160px" })).toBe(160);
  });

  it("is the least of a minmax", () => {
    expect(minColumnWidth({ width: "minmax(120px, 1fr)" })).toBe(120);
  });

  it("is the default's least for a column without a width", () => {
    expect(minColumnWidth({})).toBe(280);
  });

  it("is unknown for a width whose least isn't in px", () => {
    expect(minColumnWidth({ width: "minmax(min-content, 200px)" })).toBeUndefined();
    expect(minColumnWidth({ width: "minmax(10rem, 1fr)" })).toBeUndefined();
    expect(minColumnWidth({ width: "1fr" })).toBeUndefined();
  });
});

describe("isResizable", () => {
  it("is any column whose least is known, unless it says not", () => {
    expect(isResizable({ width: "160px" })).toBe(true);
    expect(isResizable({ width: "160px", resizable: false })).toBe(false);
    expect(isResizable({ width: "minmax(10rem, 1fr)" })).toBe(false);
  });
});

describe("columnTrack", () => {
  it("is the column's own track until it's resized", () => {
    expect(columnTrack({ width: "160px" })).toBe("160px");
    expect(columnTrack({})).toBe(DEFAULT_COLUMN_WIDTH);
  });

  it("fixes a fixed column at its resized width", () => {
    expect(columnTrack({ width: "160px" }, 240)).toBe("240px");
  });

  it("stops a column that shared what's left doing so, at its resized width", () => {
    expect(columnTrack({}, 400)).toBe("400px");
  });

  it("never goes below the column's least", () => {
    expect(columnTrack({ width: "160px" }, 100)).toBe("160px");
  });
});

describe("columnTracks", () => {
  const NAME = { id: "name" };
  const SIZE = { id: "size", width: "80px" as const };
  const ACTIONS = { id: "actions", width: "120px" as const, sticky: "end" as const };
  const none = () => undefined;

  it("leaves what's left to a column that shares it", () => {
    expect(columnTracks([NAME, SIZE, ACTIONS], none, true)).toEqual([
      DEFAULT_COLUMN_WIDTH,
      "80px",
      "120px",
    ]);
  });

  it("gives what's left to a gap before the sticky column once none shares it", () => {
    const widths: { [id: string]: number } = { name: 400 };
    expect(columnTracks([NAME, SIZE, ACTIONS], (id) => widths[id], true)).toEqual([
      "400px",
      "80px",
      "minmax(0, 1fr)",
      "120px",
    ]);
  });

  it("puts the gap last without a sticky column", () => {
    expect(columnTracks([SIZE], none, true)).toEqual(["80px", "minmax(0, 1fr)"]);
  });

  it("leaves a table whose columns don't resize as its columns have it", () => {
    expect(columnTracks([SIZE, ACTIONS], () => 300, false)).toEqual(["80px", "120px"]);
  });

  it("keeps a column that can't be resized at its own width", () => {
    expect(columnTracks([{ ...SIZE, resizable: false }], () => 300, true)).toEqual([
      "80px",
      "minmax(0, 1fr)",
    ]);
  });
});

describe("keptWidth", () => {
  it("keeps a width past the column's least, rounded", () => {
    expect(keptWidth({ width: "160px" }, 200.4)).toBe(200);
  });

  it("keeps a column that shares what's left at its least, as its own would fill the table", () => {
    expect(keptWidth({}, 280)).toBe(280);
    expect(keptWidth({}, 200)).toBe(280);
  });

  it("keeps nothing for a fixed column once it's down to the least", () => {
    expect(keptWidth({ width: "160px" }, 160)).toBeUndefined();
    expect(keptWidth({ width: "160px" }, 90)).toBeUndefined();
  });
});
