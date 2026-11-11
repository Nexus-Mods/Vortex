import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Search } from "@/ui/components/search/Search";

import { useBrowseModsTracker } from "../../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import {
  type IModSearch,
  MAX_QUERY_LENGTH,
  MIN_QUERY_CHARACTERS,
  searchQueryFor,
} from "../../../hooks/use_mod_search/useModSearch.hook";

interface IModSearchBoxProps {
  /** The mod search whose names it searches, and the view it's in. */
  search: Pick<IModSearch, "searchText" | "setSearchText" | "viewId" | "trackedView">;
}

/**
 * The box that searches Browse's mods by name. It searches on Enter, or says the text is too short
 * to until it changes or focus leaves. It clears the search at once when emptied, or on Enter with
 * only spaces. It goes back to the text searched for whenever that changes or another view opens,
 * dropping an edit not yet searched. Counts each search that changes what's searched, and each
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
      onBlur={() => setIsTooShort(false)}
      onSubmit={() => {
        const query = searchQueryFor(draft);

        if (!draft.trim()) {
          if (search.searchText) {
            search.setSearchText("");
            tracker.trackSearchCleared({ view, source: "box" });
          }

          return;
        }

        if (!query) {
          setIsTooShort(true);
          return;
        }

        if (query === searchQueryFor(search.searchText)) {
          return;
        }

        search.setSearchText(draft);
        tracker.trackSearchSubmitted({ view, query_length: query.length });
      }}
    />
  );
};
