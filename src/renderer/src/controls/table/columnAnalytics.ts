import type { MixpanelEvent } from "../../extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { ITableAttribute } from "../../types/ITableAttribute";

/** What a table's columns are doing at a moment in time, by attribute id. */
export interface ITableColumns {
  /** On show, in the order they appear left to right. */
  visible: string[];
  /** Offered by the table's own toggle menu, but switched off. */
  hidden: string[];
}

/**
 * Whether what happens to an attribute is counted as happening to a column. Only the
 * ones that can appear as a column can: an attribute confined to the details pane, or
 * rendered inline in another cell, is not what a decision to drop a column is about.
 */
export const isColumn = (attribute: ITableAttribute): boolean =>
  ["table", "both"].includes(attribute.placement);

/**
 * Splits a table's attributes into the columns on show and the ones its toggle menu
 * offers but the user has switched off, so that a column absent from both lists reads
 * as "never offered here" — no extension to provide it, or its own `condition` said no
 * — rather than as one somebody turned off.
 *
 * `visible` is the table's own list rather than one worked out again here, so what is
 * reported can't come to disagree with what is drawn.
 */
export const columnsOf = ({
  attributes,
  visible,
  blacklist = [],
}: {
  attributes: ITableAttribute[];
  visible: ITableAttribute[];
  blacklist?: string[];
}): ITableColumns => {
  const excluded = new Set(blacklist);
  const shown = new Set(visible.map((attribute) => attribute.id));

  return {
    visible: visible.map((attribute) => attribute.id),
    hidden: attributes
      .filter(
        (attribute) =>
          isColumn(attribute) &&
          attribute.isToggleable === true &&
          !excluded.has(attribute.id) &&
          (attribute.condition?.() ?? true) &&
          !shown.has(attribute.id),
      )
      .map((attribute) => attribute.id),
  };
};

/**
 * Says which columns a table is showing, so that a decision to drop one rests on how
 * many installs still have it rather than on guesswork. One event per table per game
 * per session keeps the answer per-install: the page can be left and come back to any
 * number of times without weighting one user's layout more than another's.
 */
const columnsViewedEvent = (table: string, { visible, hidden }: ITableColumns): MixpanelEvent => ({
  eventName: "app_table_columns_viewed",
  properties: {
    table,
    visible_columns: visible,
    hidden_columns: hidden,
    visible_column_count: visible.length,
  },
});

/**
 * Says that the user showed or hid a column themselves, which the snapshot alone
 * cannot: it can't tell a default nobody minded from one somebody chose.
 */
const columnToggledEvent = (table: string, column: string, visible: boolean): MixpanelEvent => ({
  eventName: "app_table_column_toggled",
  properties: { table, column, visible },
});

/**
 * Table and game pairs this session has already reported. Module scope, so it is the
 * window's lifetime that bounds it: a reload is a new session and reports again, which
 * is the same thing every other per-session count here means.
 */
const reported = new Set<string>();

/**
 * Keyed by game as well as table, because game extensions contribute columns and those
 * are the ones that differ from one game to the next. Keyed on the table alone, a user
 * who switched game mid-session reported nothing the second time and their only snapshot
 * was stamped with whichever game they happened to open first.
 *
 * The game is the numeric Nexus id, the same one the event is stamped with. Keying on the
 * internal id instead let a report be gated as one game and labelled another, because the
 * two resolve at different times. See {@link gameIdPending}.
 *
 * Neither a game id nor a table id contains a colon, so the two can't run together.
 */
const reportKey = (table: string, game: number | null): string => `${game ?? "none"}:${table}`;

/**
 * Whether a game is active but the numeric id it reports under hasn't arrived yet.
 *
 * The internal id is in state from the first frame; the numeric one comes from the games
 * list. Until this session looks it up, mixpanel's `game_id` super property still holds
 * the last session's, so reporting in that window labels the snapshot with the wrong game
 * and spends the slot on it. No active game at all is not that case: nothing is coming.
 */
export const gameIdPending = (
  internalGameId: string | undefined,
  numericGameId: number | null,
): boolean => internalGameId !== undefined && numericGameId === null;

/** Forgets what this session reported. For tests; a session has no reason to. */
export const resetReportedColumns = (): void => reported.clear();

/**
 * Reports `table`'s columns, once per game per session. Silent on a table showing nothing
 * yet: attributes arrive from extensions and can be gated on state, so an empty list means
 * the set hasn't settled rather than that the user hid everything — and the table refuses
 * to hide its last column anyway.
 *
 * `game` bounds the gate only. What the event is stamped with is mixpanel's `game_id`
 * super property, so this is the numeric id and the caller is expected to have waited for
 * one. See {@link gameIdPending}.
 */
export const emitTableColumnsViewed = (
  api: IExtensionApi,
  table: string,
  game: number | null,
  columns: ITableColumns,
): void => {
  const key = reportKey(table, game);

  if (columns.visible.length === 0 || reported.has(key)) {
    return;
  }

  reported.add(key);
  api.events.emit("analytics-track-mixpanel-event", columnsViewedEvent(table, columns));
};

/** Reports a column the user showed or hid, with `visible` the state moved *to*. */
export const emitTableColumnToggled = (
  api: IExtensionApi,
  table: string,
  column: string,
  visible: boolean,
): void => {
  api.events.emit("analytics-track-mixpanel-event", columnToggledEvent(table, column, visible));
};
