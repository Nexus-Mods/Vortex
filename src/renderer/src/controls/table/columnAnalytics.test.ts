/**
 * Tests for the table column analytics: what the snapshot counts as hidden as opposed to
 * never offered, that it reports a table once per session, and that a toggle reports the
 * state it moved to.
 */
import { EventEmitter } from "events";

import { beforeEach, describe, expect, it } from "vitest";

import type { MixpanelEvent } from "../../extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { ITableAttribute, Placement } from "../../types/ITableAttribute";
import {
  columnsOf,
  emitTableColumnsViewed,
  emitTableColumnToggled,
  isColumn,
  resetReportedColumns,
} from "./columnAnalytics";

function harness() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (event: MixpanelEvent) => events.push(event));
  return { api: { events: emitter } as unknown as IExtensionApi, events };
}

const attribute = (
  id: string,
  overrides: {
    placement?: Placement;
    isToggleable?: boolean;
    condition?: () => boolean;
  } = {},
): ITableAttribute =>
  ({
    id,
    name: id,
    placement: "table",
    isToggleable: true,
    edit: {},
    ...overrides,
  }) as ITableAttribute;

describe("table column analytics", () => {
  beforeEach(() => {
    resetReportedColumns();
  });

  describe("columnsOf", () => {
    it("reports the visible columns in the order the table draws them", () => {
      const name = attribute("name");
      const version = attribute("version");

      expect(
        columnsOf({ attributes: [version, name], visible: [name, version] }).visible,
      ).toStrictEqual(["name", "version"]);
    });

    it("counts a toggleable column that isn't showing as hidden", () => {
      const name = attribute("name");
      const author = attribute("author");

      expect(columnsOf({ attributes: [name, author], visible: [name] }).hidden).toStrictEqual([
        "author",
      ]);
    });

    it("leaves out what the table never offered, so it doesn't read as switched off", () => {
      const name = attribute("name");
      const fixed = attribute("fixed", { isToggleable: false });
      const unavailable = attribute("unavailable", { condition: () => false });
      const detail = attribute("notes", { placement: "detail" });
      const inline = attribute("flag", { placement: "inline" });

      const { hidden } = columnsOf({
        attributes: [name, fixed, unavailable, detail, inline],
        visible: [name],
      });

      expect(hidden).toStrictEqual([]);
    });

    it("leaves out a blacklisted column, which the page took away rather than the user", () => {
      const name = attribute("name");
      const blacklisted = attribute("game");

      const { hidden } = columnsOf({
        attributes: [name, blacklisted],
        visible: [name],
        blacklist: ["game"],
      });

      expect(hidden).toStrictEqual([]);
    });
  });

  describe("isColumn", () => {
    it("counts attributes that can appear as a column, and nothing else", () => {
      expect(isColumn(attribute("name"))).toBe(true);
      expect(isColumn(attribute("name", { placement: "both" }))).toBe(true);
      expect(isColumn(attribute("notes", { placement: "detail" }))).toBe(false);
      expect(isColumn(attribute("flag", { placement: "inline" }))).toBe(false);
    });
  });

  describe("emitTableColumnsViewed", () => {
    it("says which columns are on show, which are off, and how many there are", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", { visible: ["name", "version"], hidden: ["author"] });

      expect(h.events).toHaveLength(1);
      expect(h.events[0].eventName).toBe("app_table_columns_viewed");
      expect(h.events[0].properties).toStrictEqual({
        table: "mods",
        columns: ["name", "version"],
        hidden_columns: ["author"],
        column_count: 2,
      });
    });

    it("reports a table once a session, however often the page is opened", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", { visible: ["name"], hidden: [] });
      emitTableColumnsViewed(h.api, "mods", { visible: ["name", "version"], hidden: [] });

      expect(h.events).toHaveLength(1);
    });

    it("reports each table separately", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", { visible: ["name"], hidden: [] });
      emitTableColumnsViewed(h.api, "downloads", { visible: ["filename"], hidden: [] });

      expect(h.events.map((event) => event.properties.table)).toStrictEqual(["mods", "downloads"]);
    });

    it("says nothing about a table with no columns yet, and reports it once it has some", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", { visible: [], hidden: [] });
      expect(h.events).toHaveLength(0);

      emitTableColumnsViewed(h.api, "mods", { visible: ["name"], hidden: [] });
      expect(h.events).toHaveLength(1);
    });
  });

  describe("emitTableColumnToggled", () => {
    it("reports the state the column moved to", () => {
      const h = harness();

      emitTableColumnToggled(h.api, "mods", "author", false);

      expect(h.events).toHaveLength(1);
      expect(h.events[0].eventName).toBe("app_table_column_toggled");
      expect(h.events[0].properties).toStrictEqual({
        table: "mods",
        column: "author",
        visible: false,
      });
    });

    it("reports every toggle, so a column switched on and off again says so twice", () => {
      const h = harness();

      emitTableColumnToggled(h.api, "mods", "author", true);
      emitTableColumnToggled(h.api, "mods", "author", false);

      expect(h.events.map((event) => event.properties.visible)).toStrictEqual([true, false]);
    });
  });
});
