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

/** The active game the plain cases report under; the per-game cases name their own. */
const GAME = "skyrimse";

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

      emitTableColumnsViewed(h.api, "mods", GAME, {
        visible: ["name", "version"],
        hidden: ["author"],
      });

      expect(h.events).toHaveLength(1);
      expect(h.events[0].eventName).toBe("app_table_columns_viewed");
      expect(h.events[0].properties).toStrictEqual({
        table: "mods",
        visible_columns: ["name", "version"],
        hidden_columns: ["author"],
        visible_column_count: 2,
      });
    });

    it("reports a table once a session, however often the page is opened", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", GAME, { visible: ["name"], hidden: [] });
      emitTableColumnsViewed(h.api, "mods", GAME, { visible: ["name", "version"], hidden: [] });

      expect(h.events).toHaveLength(1);
    });

    it("reports each table separately", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", GAME, { visible: ["name"], hidden: [] });
      emitTableColumnsViewed(h.api, "downloads", GAME, { visible: ["filename"], hidden: [] });

      expect(h.events.map((event) => event.properties.table)).toStrictEqual(["mods", "downloads"]);
    });

    // Two tables can share the `tableId` their layout is stored against — authoring a
    // collection and viewing one are both `collection-mods` — so the gate keys on the id
    // it is handed, not on the table. Handing it one id for two different sets of columns
    // is what would report whichever came first and silently drop the other.
    it("gates on the id it is handed, so tables sharing a layout id each report", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "collection-mods-edit", GAME, {
        visible: ["name", "phase"],
        hidden: ["category"],
      });
      emitTableColumnsViewed(h.api, "collection-mods-view", GAME, {
        visible: ["name", "uploader"],
        hidden: [],
      });

      expect(h.events.map((event) => event.properties.table)).toStrictEqual([
        "collection-mods-edit",
        "collection-mods-view",
      ]);
      expect(h.events.map((event) => event.properties.visible_columns)).toStrictEqual([
        ["name", "phase"],
        ["name", "uploader"],
      ]);
    });

    // Game extensions contribute columns, and those are the ones that differ from one game
    // to the next. Keyed on the table alone, a user who switched game mid-session reported
    // nothing the second time and their only snapshot was stamped with the first game.
    it("reports a table again for a game it hasn't been reported for", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", "skyrimse", { visible: ["name", "esp"], hidden: [] });
      emitTableColumnsViewed(h.api, "mods", "stardewvalley", { visible: ["name"], hidden: [] });

      expect(h.events.map((event) => event.properties.visible_columns)).toStrictEqual([
        ["name", "esp"],
        ["name"],
      ]);
    });

    it("still reports a table once for a game it has been reported for", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", "skyrimse", { visible: ["name"], hidden: [] });
      emitTableColumnsViewed(h.api, "mods", "stardewvalley", { visible: ["name"], hidden: [] });
      emitTableColumnsViewed(h.api, "mods", "skyrimse", { visible: ["name", "esp"], hidden: [] });

      expect(h.events).toHaveLength(2);
    });

    it("counts no active game as a game of its own", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "extensions", undefined, { visible: ["name"], hidden: [] });
      emitTableColumnsViewed(h.api, "extensions", undefined, { visible: ["name"], hidden: [] });

      expect(h.events).toHaveLength(1);
    });

    it("says nothing about a table with no columns yet, and reports it once it has some", () => {
      const h = harness();

      emitTableColumnsViewed(h.api, "mods", GAME, { visible: [], hidden: [] });
      expect(h.events).toHaveLength(0);

      emitTableColumnsViewed(h.api, "mods", GAME, { visible: ["name"], hidden: [] });
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
