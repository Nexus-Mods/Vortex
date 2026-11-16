import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";

import type { EmptyStateKind } from "../../../util/empty_state_kind/emptyStateKind";

// TODO: where "Learn more" goes isn't decided; the link shows once this is set.
export const LEARN_MORE_URL = "";

/** Which states offer Remove filters, while any are on. */
const OFFERS_REMOVE_FILTERS: EmptyStateKind[] = [
  "end_of_results",
  "search_and_filters",
  "filters_only",
];

/** Which states offer Clear search, while there's a search. */
const OFFERS_CLEAR_SEARCH: EmptyStateKind[] = [
  "end_of_results",
  "search_only",
  "search_and_filters",
];

/** Each state's heading and message, in its words. */
const stateText = (
  t: TFunction,
  kind: EmptyStateKind,
  searchText: string | undefined,
  gameName: string | undefined,
) => {
  switch (kind) {
    case "end_of_results": {
      const title = t("You've reached the end");

      if (searchText) {
        return { title, message: t("That's every mod Vortex can show for this search.") };
      }

      return { title, message: t("That's every mod Vortex can show for this view.") };
    }
    case "search_only":
      return {
        title: t('No mods match "{{search}}"', { search: searchText }),
        message: t("Try a different search."),
      };
    case "search_and_filters":
      return {
        title: t('No mods match "{{search}}"', { search: searchText }),
        message: t("Try a different search or remove filters."),
      };
    case "filters_only":
      return {
        title: t("No mods match your filters"),
        message: t("Try removing some filters."),
      };
    case "nothing_for_game": {
      const message = t(
        "None have been added yet, or the ones that exist can't be shown in Vortex.",
      );

      if (!gameName) {
        return { title: t("No mods to show for this game"), message };
      }

      return { title: t("No mods to show for {{game}}", { game: gameName }), message };
    }
  }
};

interface IModListEmptyStateProps {
  /** Which state it is. */
  kind: EmptyStateKind;
  /** The search text, for the search states' headings, and the end's message; none for none. */
  searchText?: string;
  /** The active game's name; "this game" without one. */
  gameName?: string;
  /** How many filters Remove filters would clear, locked ones left out. */
  filterCount: number;
  /** Clears those filters. */
  onRemoveFilters: () => void;
  /** Clears the search, offered with one on in the search states and at the end. */
  onClearSearch: () => void;
  /** Opens the same search on Nexus Mods; Search on website is left out without it. */
  onSearchWebsite?: () => void;
  /** Opens where Learn more goes. */
  onLearnMore: () => void;
}

/**
 * Why Browse's mod list is empty, or that it's reached its end, with the ways out: removing the
 * filters, clearing the search, or the same search on the website, on a dark panel. Notes that
 * Vortex hides some mods.
 */
export const ModListEmptyState = ({
  kind,
  searchText,
  gameName,
  filterCount,
  onRemoveFilters,
  onClearSearch,
  onSearchWebsite,
  onLearnMore,
}: IModListEmptyStateProps) => {
  const { t } = useTranslation();
  const { title, message } = stateText(t, kind, searchText, gameName);
  const canRemoveFilters = filterCount > 0 && OFFERS_REMOVE_FILTERS.includes(kind);
  const canClearSearch = !!searchText && OFFERS_CLEAR_SEARCH.includes(kind);

  return (
    <NoResults
      className="w-full rounded-sm bg-translucent-dark-200 p-8"
      footnote={
        <>
          <span data-testid="mod-list-hidden-mods-note">
            {t("Mods that don't support mod managers or use legacy requirements are hidden.")}
          </span>

          {!!LEARN_MORE_URL && (
            <>
              {` `}

              <a
                className="underline"
                href={LEARN_MORE_URL}
                onClick={(event) => {
                  event.preventDefault();
                  onLearnMore();
                }}
              >
                {t("Learn more")}
              </a>
            </>
          )}
        </>
      }
      message={message}
      title={title}
    >
      {(canRemoveFilters || canClearSearch || !!onSearchWebsite) && (
        <div className="flex flex-wrap justify-center gap-2">
          {canRemoveFilters && (
            <Button
              appearance="moderate"
              brand="neutral"
              leftIcon="close"
              onClick={onRemoveFilters}
            >
              {filterCount === 1
                ? t("Remove 1 filter")
                : t("Remove {{count}} filters", { count: filterCount })}
            </Button>
          )}

          {canClearSearch && (
            <Button appearance="moderate" brand="neutral" leftIcon="close" onClick={onClearSearch}>
              {t("Clear search")}
            </Button>
          )}

          {!!onSearchWebsite && (
            <Button
              appearance="moderate"
              brand="neutral"
              rightIcon="open_in_new"
              onClick={onSearchWebsite}
            >
              {t("Search on website")}
            </Button>
          )}
        </div>
      )}
    </NoResults>
  );
};
