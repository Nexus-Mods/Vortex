import { createAction } from "redux-act";

import type { BrowseSection } from "../util/browseSection";

/** Sets Browse's open section, as its tabs and links to it from elsewhere do; none for its default. */
export const setBrowseSection = createAction(
  "SET_BROWSE_SECTION",
  (section?: BrowseSection) => section,
);

/** Sets the text Browse searches its mods' names for, kept across views until a restart. */
export const setBrowseModSearchText = createAction(
  "SET_BROWSE_MOD_SEARCH_TEXT",
  (text: string) => text,
);
