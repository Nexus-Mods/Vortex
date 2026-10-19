import type { TFunction } from "i18next";

import type { ITableGroup } from "@/ui/components/table/Table.types";

import { MOD_TYPE as COLLECTION_TYPE } from "../../../collections/constants";
import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import { modHasUpdate } from "../mod_has_update/modHasUpdate";
import modName from "../modName";
import { uploaderAvatar } from "../uploaderAvatar";

export interface IModRow {
  /** The mod the row shows. */
  mod: IModWithState;
  /** Its display name, which the rows sort by. */
  name: string;
}

export interface IModGroup extends ITableGroup<IModRow> {
  /** The collection the group is for, if it's one; its picture goes on the group's row. */
  collection?: IMod;
  /** For an author's group, their avatar; `src` unset when it isn't known whose face. */
  avatar?: { src?: string };
}

/** What the table groups the mods by: "none" lists them flat, otherwise a column's id. */
export type ModsTableGrouping = string;

/** A column the table can group by, from the value it gives each row. */
export interface IModsTableGroupingColumn {
  id: string;
  header: string;
  /** The value a row is grouped under; "" for none. */
  groupBy: (row: IModRow) => string;
  /** Values whose groups come first, in this order; the rest follow by name. */
  groupOrder?: string[];
}

/** How a view starts out, before the user changes it. */
export interface IModsTableViewDefaults {
  /** What its mods are grouped by. */
  grouping: ModsTableGrouping;
  /** The toggleable columns it shows, by id; the rest are hidden. */
  columns: string[];
}

export interface IModsTableView {
  /** Stable, unique, and language-independent, so a choice of view can be stored. */
  id: string;
  /** The view's name: untranslated for a built-in one, as the user typed it for their own. */
  label: string;
  defaults: IModsTableViewDefaults;
  /** Whether it's one of the user's own, which has no defaults to reset to. */
  isCustom?: boolean;
}

/** A built-in view, which is only offered while it has something to show. */
interface IBuiltInModsTableView extends IModsTableView {
  /** Whether to offer it for these mods; always, without one. */
  isAvailable?: (mods: { [id: string]: IModWithState }) => boolean;
}

const BASE_COLUMNS = ["version", "installTime"];

/** How a view the user makes starts out. */
export const NEW_VIEW_DEFAULTS: IModsTableViewDefaults = {
  grouping: "none",
  columns: BASE_COLUMNS,
};

/** The views every user has, in order, each offered while it has anything to show. */
export const MODS_TABLE_VIEWS: IBuiltInModsTableView[] = [
  { id: "all", label: "All mods", defaults: { grouping: "none", columns: BASE_COLUMNS } },
  { id: "status", label: "Status", defaults: { grouping: "status", columns: BASE_COLUMNS } },
  {
    id: "updates",
    label: "Updates",
    defaults: { grouping: "version", columns: BASE_COLUMNS },
    isAvailable: (mods) =>
      Object.values(mods).some((mod) => mod.state === "installed" && modHasUpdate(mod)),
  },
  {
    id: "categories",
    label: "Categories",
    defaults: { grouping: "category", columns: BASE_COLUMNS },
  },
  {
    id: "collections",
    label: "Collections",
    defaults: { grouping: "collection", columns: ["version", "collection", "installTime"] },
    isAvailable: (mods) => Object.values(mods).some((mod) => mod.type === COLLECTION_TYPE),
  },
];

/** The built-in views to offer for these mods, in order. */
export const availableViews = (mods: { [id: string]: IModWithState }): IModsTableView[] =>
  MODS_TABLE_VIEWS.filter((view) => view.isAvailable?.(mods) ?? true);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const toRows = (mods: IModWithState[]): IModRow[] =>
  mods.map((mod) => ({ mod, name: modName(mod) })).sort(byName);

// Every view's rows; a collection heads its group instead, so it's never one.
const installedMods = (mods: { [id: string]: IModWithState }) =>
  toRows(Object.values(mods).filter((mod) => mod.type !== COLLECTION_TYPE));

// Pushes rather than copies, so a large group costs one pass, not a copy per row.
const addRow = (groups: Map<string, IModRow[]>, key: string, row: IModRow) => {
  const rows = groups.get(key);

  if (!rows) {
    groups.set(key, [row]);
    return;
  }

  rows.push(row);
};

// A group for the mods that fit no other, first, when there are any.
const ungroupedFirst = (id: string, label: string, rows: IModRow[]): IModGroup[] =>
  rows.length > 0 ? [{ id, label, rows }] : [];

/**
 * The mods from no collection, then the mods grouped by the collections they came from.
 * Without a collection there's nothing to group by, so that's undefined.
 */
const groupByCollection = (
  mods: { [id: string]: IModWithState },
  t: TFunction,
  memberships: { [modId: string]: IMod[] },
): IModGroup[] | undefined => {
  const byCollection = new Map<string, IModRow[]>();
  const ungrouped: IModRow[] = [];

  installedMods(mods).forEach((row) => {
    const members = memberships[row.mod.id] ?? [];

    if (members.length === 0) {
      ungrouped.push(row);
      return;
    }

    // A collection can list the same mod more than once, but it's one row in its group.
    new Set(members.map((member) => member.id)).forEach((id) => addRow(byCollection, id, row));
  });

  const collectionGroups = Object.values(mods)
    .filter((mod) => mod.type === COLLECTION_TYPE)
    .map((collection) => ({ collection, name: modName(collection) }))
    .sort(byName)
    .map(({ collection, name }) => ({
      id: collection.id,
      label: name,
      collection,
      image: collection.attributes?.pictureUrl,
      rows: byCollection.get(collection.id) ?? [],
    }));

  if (collectionGroups.length === 0) {
    return undefined;
  }

  return [...ungroupedFirst("no-collection", t("No collection"), ungrouped), ...collectionGroups];
};

/**
 * The author's avatar, from a mod they uploaded themselves. Only the uploader's is known,
 * and the author can be someone else, so a mod uploaded by another name says nothing
 * about the author's face.
 */
const authorAvatar = (author: string, rows: IModRow[]): string | undefined => {
  const attributes = rows.find(
    ({ mod }) =>
      mod.attributes?.uploader === author &&
      (!!mod.attributes?.uploaderAvatar || !!mod.attributes?.uploaderId),
  )?.mod.attributes;

  if (attributes === undefined) {
    return undefined;
  }

  return uploaderAvatar(attributes);
};

/** The mods with no author, then the mods grouped by author, by name. */
const groupByAuthor = (mods: { [id: string]: IModWithState }, t: TFunction): IModGroup[] => {
  const byAuthor = new Map<string, IModRow[]>();
  const unknown: IModRow[] = [];

  installedMods(mods).forEach((row) => {
    const author = row.mod.attributes?.author?.trim();

    if (!author) {
      unknown.push(row);
      return;
    }

    addRow(byAuthor, author, row);
  });

  const authorGroups = Array.from(byAuthor, ([author, rows]) => {
    const src = authorAvatar(author, rows);
    return { id: `author:${author}`, label: author, rows, avatar: { src }, image: src };
  }).sort((a, b) => a.label.localeCompare(b.label));

  // No one to show, but the same place for it, so the names line up.
  const noAuthor = ungroupedFirst("no-author", t("No author"), unknown).map((group) => ({
    ...group,
    avatar: {},
  }));

  return [...noAuthor, ...authorGroups];
};

/**
 * The mods with no value for the column first, then the mods by its values: those in its
 * `groupOrder` in that order, then the rest by name.
 */
const groupByColumn = (
  mods: { [id: string]: IModWithState },
  column: IModsTableGroupingColumn,
  t: TFunction,
): IModGroup[] => {
  const byValue = new Map<string, IModRow[]>();
  const none: IModRow[] = [];

  installedMods(mods).forEach((row) => {
    const value = column.groupBy(row).trim();

    if (!value) {
      none.push(row);
      return;
    }

    addRow(byValue, value, row);
  });

  const valueGroups = Array.from(byValue, ([value, rows]) => ({
    id: `${column.id}:${value}`,
    label: value,
    rows,
  })).sort((a, b) => {
    const order = column.groupOrder ?? [];
    // Unlisted values rank after every listed one, then fall back to their names.
    const rank = (value: string) => (order.includes(value) ? order.indexOf(value) : order.length);
    return rank(a.label) - rank(b.label) || a.label.localeCompare(b.label);
  });

  const noValue = ungroupedFirst(
    `no-${column.id}`,
    t("No {{column}}", { column: column.header.toLocaleLowerCase() }),
    none,
  );

  return [...noValue, ...valueGroups];
};

/**
 * The groups for a grouping, or undefined for a flat list of every mod. Collections and
 * authors have groups of their own, with pictures; any other column groups by its values.
 * Collections group by `memberships`, from collectionsByMod, worked out once by the caller.
 */
export const groupMods = (
  mods: { [id: string]: IModWithState },
  grouping: ModsTableGrouping,
  t: TFunction,
  memberships: { [modId: string]: IMod[] },
  column?: IModsTableGroupingColumn,
): IModGroup[] | undefined => {
  if (grouping === "collection") {
    return groupByCollection(mods, t, memberships);
  }

  if (grouping === "author") {
    return groupByAuthor(mods, t);
  }

  if (column !== undefined && column.id === grouping) {
    return groupByColumn(mods, column, t);
  }

  return undefined;
};

/** Every mod but the collections, which head groups rather than list as rows, by name. */
export const allModRows = (mods: { [id: string]: IModWithState }): IModRow[] => installedMods(mods);

export interface ISharedMods {
  /** The group's mods other collections have too. */
  rows: IModRow[];
  /** The names of those other collections, by name. */
  collections: string[];
}

/**
 * The group's mods that also belong to a collection other than the group's own, and
 * those collections: what disabling the group would take from them.
 */
export const sharedMods = (
  group: IModGroup,
  memberships: { [modId: string]: IMod[] },
): ISharedMods => {
  const collections = new Map<string, string>();

  const rows = group.rows.filter(({ mod }) => {
    const others = (memberships[mod.id] ?? []).filter(
      (collection) => collection.id !== group.collection?.id,
    );
    others.forEach((collection) => collections.set(collection.id, modName(collection)));
    return others.length > 0;
  });

  return { rows, collections: Array.from(collections.values()).sort((a, b) => a.localeCompare(b)) };
};
