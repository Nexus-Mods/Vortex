import type {
  ICollection,
  ICollectionSearchOptions,
  CollectionSortField,
  SortDirection,
} from "@nexusmods/nexus-api";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { CollectionsDownloadClickedEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import { getGame } from "@/extensions/gamemode_management/util/getGame";
import { buildNXMCollectionUrl } from "@/extensions/nexus_integration/NXMUrl";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { UserCanceled } from "@/util/api";
import { activeGameId } from "@/util/selectors";

export interface ISortOption {
  field: CollectionSortField;
  direction: SortDirection;
  label: string;
}

export const SORT_OPTIONS: ISortOption[] = [
  { field: "createdAt", direction: "DESC", label: "Recently Listed" },
  { field: "endorsements", direction: "DESC", label: "Most Endorsed" },
  { field: "recentRating", direction: "DESC", label: "Highest Rated" },
  { field: "downloads", direction: "DESC", label: "Most Downloaded" },
];

export const COLLECTIONS_PER_PAGE = 20;

async function adultContentDialog(
  api: IExtensionApi,
  collection: ICollection,
  adultContent: boolean,
): Promise<boolean> {
  try {
    const result = await api.showDialog(
      "question",
      "Adult content warning",
      {
        bbcode: api.translate(
          `The collection "[b]{{collectionName}}[/b]" has been classified as adult content because it contains: nudity, sexualisation, extreme violence and gore, or excessive profanity.<br/><br/>` +
            `Your site preferences are set to hide adult content, you can update your preferences on the Nexus Mods website.`,
          { replace: { collectionName: collection.name } },
        ),
      },
      [{ label: api.translate("Cancel") }, { label: api.translate("Open site preferences") }],
    );
    return result.action === "Cancel" ? false : true;
  } catch {
    return adultContent;
  }
}

/** Translates in the collection namespace, as the collections browser always has. */
export const collectionT =
  (api: IExtensionApi) => (input: string, options?: Record<string, unknown>) =>
    api.translate(input, {
      isNamespaceKey: true,
      ns: ["collection", "common"],
      ...options,
    });

/**
 * The active game's listed collections, searched, sorted and a page at a time, and adding
 * one. Kept above the Browse page's tabs, so the Collections tab's count and its search
 * outlive switching to Mods and back.
 */
export const useCollectionSearch = (api: IExtensionApi) => {
  const t = collectionT(api);

  const gameId = useSelector((state: IState) => activeGameId(state));
  const gameDomainName = nexusGameId(getGame(gameId), gameId);

  const isLoggedIn = useSelector((state: IState) => {
    const nexus = state.confidential?.account?.["nexus"];
    return !!(nexus?.APIKey || nexus?.OAuthCredentials);
  });
  const adultContentFilter = useSelector(
    (state: IState) => state.persistent["nexus"]?.userInfo?.adult,
  );
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [allCollectionsTotal, setAllCollectionsTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [sortBy, setSortBy] = useState<ISortOption>(SORT_OPTIONS[1]); // Default to "Most Endorsed"
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>(""); // The search term actually being used
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [searchValidationError, setSearchValidationError] = useState<string>("");

  const handleSearch = () => {
    // Clear any previous validation errors
    setSearchValidationError("");

    // If search query is too short (1 character), show validation error
    if (searchQuery.length === 1) {
      setSearchValidationError(t("collection:browse.searchTooShort"));
      return;
    }

    // If search query is empty, clear the search
    // If search query is 2+ characters, perform the search
    setActiveSearch(searchQuery);
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAddCollection = (collection: ICollection) => {
    const revisionNumber = collection.latestPublishedRevision?.revisionNumber || "latest";
    // Use the game domain name from the collection data (already converted)
    const nxmUrl = buildNXMCollectionUrl(
      collection.game.domainName,
      collection.slug,
      revisionNumber,
    );

    // Track the download click event
    api.events.emit(
      "analytics-track-mixpanel-event",
      new CollectionsDownloadClickedEvent(collection.slug, collection.game.id),
    );

    if (adultContentFilter === false && collection.latestPublishedRevision?.adultContent) {
      void adultContentDialog(api, collection, false).then((proceed) => {
        if (proceed) {
          window.api.shell.openUrl("https://next.nexusmods.com/settings/content-blocking");
        }
      });
    } else {
      // Use the Vortex API to handle the NXM link.
      // Populate modInfo.nexus.ids so the persisted download is recognised as
      // a collection by `nexusIdsFromDownloadId` — without these fields the
      // download-completed analytics in DownloadObserver can't tell it apart
      // from a non-Nexus download and silently skips the event.
      api.events.emit(
        "start-download",
        [nxmUrl],
        {
          game: gameId,
          source: "nexus",
          name: collection.name,
          nexus: {
            ids: {
              gameId: collection.game.domainName,
              collectionId: collection.id,
              revisionId: collection.latestPublishedRevision?.id,
              collectionSlug: collection.slug,
              revisionNumber: collection.latestPublishedRevision?.revisionNumber,
            },
          },
        },
        undefined,
        (err: Error) => {
          if (err && !(err instanceof UserCanceled)) {
            api.showErrorNotification("Failed to add collection", err);
          }
        },
        undefined,
        { allowInstall: "force" },
      );
    }
  };

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const options: ICollectionSearchOptions = {
      gameId: gameDomainName,
      count: 20,
      offset: (currentPage - 1) * COLLECTIONS_PER_PAGE,
      sort: {
        field: sortBy.field,
        direction: sortBy.direction,
      },
      search: activeSearch || undefined,
      categoryName: [{ op: "NOT_EQUALS", value: "Wabbajack Mod List" }],
      collectionStatuses: ["listed"],
    };

    // Fetch collections using the new search API with sorting and search
    Promise.resolve(api.ext.nexusSearchCollections(options))
      .then((result: { nodes: ICollection[]; totalCount: number }) => {
        setCollections(result.nodes || []);
        setTotalCount(result.totalCount || 0);
        // Store unfiltered total when no search is active
        if (!activeSearch) {
          setAllCollectionsTotal(result.totalCount || 0);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        // Provide user-friendly error message for wildcard search requirement
        if (err.message && err.message.includes("Wildcard value must have 2 or more characters")) {
          const friendlyError = new Error(t("collection:browse.searchTooShort"));
          setError(friendlyError);
          // Also clear the invalid search so user can try again
          setActiveSearch("");
        } else {
          setError(err);
        }
        setLoading(false);
      });
  }, [gameId, sortBy, activeSearch, currentPage, api, refreshTrigger]);

  return {
    gameDomainName,
    isLoggedIn,
    collections,
    totalCount,
    allCollectionsTotal,
    loading,
    error,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    searchValidationError,
    setSearchValidationError,
    handleSearch,
    handleRefresh,
    handleAddCollection,
  };
};

export type ICollectionSearch = ReturnType<typeof useCollectionSearch>;
