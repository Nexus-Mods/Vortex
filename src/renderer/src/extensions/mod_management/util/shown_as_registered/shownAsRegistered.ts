import type { ITableAttribute } from "@/types/ITableAttribute";

/**
 * The legacy details pane's fields the Properties panel shows as its own, by attribute id, so an
 * extension's field the panel doesn't show is all that's left.
 */
const SHOWN_AS_OWN = new Set([
  "category-detail",
  "notes",
  "modSource",
  "sourceURL",
  "collection",
  "nexusModId",
  "nexusCollectionId",
  "modType",
  "downloadGame",
  "installer",
  "iniEdits",
]);

/**
 * Whether the panel draws a field an extension registered for the legacy details pane from its
 * registered value: one it doesn't show as its own, with a value or renderer of its own.
 */
export const isShownAsRegistered = ({ id, calc, customRenderer }: ITableAttribute) =>
  !SHOWN_AS_OWN.has(id) && Boolean(calc || customRenderer);
