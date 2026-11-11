import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Search } from "@/ui/components/search/Search";

import { useBrowseModsTracker } from "../../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import {
  type IModSearch,
  isSearchable,
  MAX_QUERY_LENGTH,
  MIN_QUERY_CHARACTERS,
} from "../../../hooks/use_mod_search/useModSearch.hook";

interface IModSearchBoxProps {
  /** The mod search whose names it searches, and the view it's in. */
  search: Pick<IModSearch, "searchText" | "setSearchText" | "viewId" | "trackedView">;
}

/**
 * The box that searches Browse's mods by name. It searches on Enter, or says the text is too short
 * to, and clears the search at once when emptied. It goes back to the text searched for whenever
 * that changes or another view opens, dropping an edit not yet searched. Counts each search and
 * clear.
 */
export const ModSearchBox = ({ search }: IModSearchBoxProps) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const view = search.trackedView;
  const [draft, setDraft] = useState(search.searchText);
  const [isTooShort, setIsTooShort] = useState(false);
  const [draftFor, setDraftFor] = useState({ text: search.searchText, viewId: search.viewId });

  if (draftFor.text !== search.searchText || draftFor.viewId !== search.viewId) {
    setDraftFor({ text: search.searchText, viewId: search.viewId });
    setDraft(search.searchText);
    setIsTooShort(false);
  }

  return (
    <Search
      errorMessage={
        isTooShort
          ? t("Enter at least {{count}} characters to search.", { count: MIN_QUERY_CHARACTERS })
          : undefined
      }
      maxLength={MAX_QUERY_LENGTH}
      placeholder={t("Search mods...")}
      value={draft}
      onChange={(text) => {
        setDraft(text);
        setIsTooShort(false);

        if (!text && search.searchText) {
          search.setSearchText("");
          tracker.trackSearchCleared({ view, source: "box" });
        }
      }}
      onSubmit={() => {
        if (!draft.trim()) {
          return;
        }

        if (!isSearchable(draft)) {
          setIsTooShort(true);
          return;
        }

        search.setSearchText(draft);
        tracker.trackSearchSubmitted({ view, query_length: draft.trim().length });
      }}
    />
  );
};
