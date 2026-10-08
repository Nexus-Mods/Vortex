import type { TFunction } from "i18next";

import type { ITableGroup } from "@/ui/components/table/Table.types";

import { MOD_TYPE as COLLECTION_TYPE } from "../../../collections/constants";
import { collectionsByMod } from "../../../collections/util/collectionsByMod";
import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import modName from "../modName";

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
}

export interface IModsTableView {
  /** Stable, unique, and language-independent, so a choice of view can be stored. */
  id: string;
  /** The view's name, untranslated; translate it to show it. */
  label: string;
  /** What its mods are grouped by. */
  grouping: ModsTableGrouping;
}

/**
 * The views every user has. They'll sit alongside the user's own, each a set of filters
 * and view options; for now a view is only how it groups.
 */
export const MODS_TABLE_PRESETS: IModsTableView[] = [
  { id: "all", label: "All mods", grouping: "none" },
  { id: "collections", label: "Collections", grouping: "collection" },
  { id: "author", label: "Author", grouping: "author" },
];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const toRows = (mods: IModWithState[]): IModRow[] =>
  mods.map((mod) => ({ mod, name: modName(mod) })).sort(byName);

// The mods a collection installed; collections themselves are the groups, not rows.
const installedMods = (mods: { [id: string]: IModWithState }) =>
  toRows(Object.values(mods).filter((mod) => mod.type !== COLLECTION_TYPE));

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
): IModGroup[] | undefined => {
  const memberships = collectionsByMod(mods);
  const rows = installedMods(mods);

  const collectionGroups = Object.values(mods)
    .filter((mod) => mod.type === COLLECTION_TYPE)
    .map((collection) => ({ collection, name: modName(collection) }))
    .sort(byName)
    .map(({ collection, name }) => ({
      id: collection.id,
      label: name,
      collection,
      image: collection.attributes?.pictureUrl,
      rows: rows.filter(({ mod }) =>
        (memberships[mod.id] ?? []).some((member) => member.id === collection.id),
      ),
    }));

  if (collectionGroups.length === 0) {
    return undefined;
  }

  const ungrouped = rows.filter(({ mod }) => (memberships[mod.id] ?? []).length === 0);

  return [...ungroupedFirst("no-collection", t("No collection"), ungrouped), ...collectionGroups];
};

// Where Nexus serves a member's avatar; a mod's own attributes only carry one for a
// collection, whose metadata comes from the API that returns it.
const memberAvatar = (memberId: number) => `https://avatars.nexusmods.com/${memberId}/100`;

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

  return attributes.uploaderAvatar || memberAvatar(attributes.uploaderId);
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

    byAuthor.set(author, [...(byAuthor.get(author) ?? []), row]);
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

/** The mods with no value for the column first, then the mods by its values, by name. */
const groupByColumn = (
  mods: { [id: string]: IModWithState },
  column: IModsTableGroupingColumn,
  t: TFunction,
): IModGroup[] => {
  const byValue = new Map<string, IModRow[]>();
  const none: IModRow[] = [];

  toRows(Object.values(mods)).forEach((row) => {
    const value = column.groupBy(row).trim();

    if (!value) {
      none.push(row);
      return;
    }

    byValue.set(value, [...(byValue.get(value) ?? []), row]);
  });

  const valueGroups = Array.from(byValue, ([value, rows]) => ({
    id: `${column.id}:${value}`,
    label: value,
    rows,
  })).sort((a, b) => a.label.localeCompare(b.label));

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
 */
export const groupMods = (
  mods: { [id: string]: IModWithState },
  grouping: ModsTableGrouping,
  t: TFunction,
  column?: IModsTableGroupingColumn,
): IModGroup[] | undefined => {
  if (grouping === "collection") {
    return groupByCollection(mods, t);
  }

  if (grouping === "author") {
    return groupByAuthor(mods, t);
  }

  if (column !== undefined && column.id === grouping) {
    return groupByColumn(mods, column, t);
  }

  return undefined;
};

/** Every mod, collections included, by name: the rows of a view that doesn't group. */
export const allModRows = (mods: { [id: string]: IModWithState }): IModRow[] =>
  toRows(Object.values(mods));

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
