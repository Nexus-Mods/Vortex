/** Browse's sections, by their tabs' ids. */
const BROWSE_SECTIONS = ["mods", "collections"] as const;

/** One of Browse's sections, by its tab's id. */
export type BrowseSection = (typeof BROWSE_SECTIONS)[number];

/** Whether a tab's id is one of Browse's sections. */
export const isBrowseSection = (tab: string): tab is BrowseSection =>
  (BROWSE_SECTIONS as readonly string[]).includes(tab);
