import {
  ICollection,
  ICollectionSearchOptions,
  CollectionSortField,
  SortDirection,
} from "@nexusmods/nexus-api";

import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiOpenInNew,
  mdiRefresh,
} from "@mdi/js";
import numeral from "numeral";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";

import MainPage from "../../../renderer/views/MainPage";
import Tailwind from "../../../tailwind";
import { UserCanceled } from "../../../util/api";
import opn from "../../../util/opn";
import { activeGameId, isCollectionModPresent } from "../../../util/selectors";
import { CollectionsDownloadClickedEvent } from "../../analytics/mixpanel/MixpanelEvents";
import { getGame } from "../../gamemode_management/util/getGame";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";

interface IBrowseNexusPageProps {
  api: IExtensionApi;
}

interface ISortOption {
  field: CollectionSortField;
  direction: SortDirection;
  label: string;
}

const SORT_OPTIONS: ISortOption[] = [
  { field: "createdAt", direction: "DESC", label: "Recently Listed" },
  { field: "endorsements", direction: "DESC", label: "Most Endorsed" },
  { field: "recentRating", direction: "DESC", label: "Highest Rated" },
  { field: "downloads", direction: "DESC", label: "Most Downloaded" },
];

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
      [
        { label: api.translate("Cancel") },
        { label: api.translate("Open site preferences") },
      ],
    );
    return result.action === "Cancel" ? false : true;
  } catch (err) {
    return adultContent;
  }
}

function BrowseNexusPage(props: IBrowseNexusPageProps) {
  const { api } = props;
  const t = (input: string, options?) =>
    api.translate(input, {
      isNamespaceKey: true,
      ns: ["collection", "common"],
      ...options,
    });
  const gameId = useSelector((state: IState) => activeGameId(state));
  const adultContentFilter = useSelector(
    (state: IState) => state.persistent["nexus"]?.userInfo?.adult,
  );
  const [collections, setCollections] = React.useState<ICollection[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [allCollectionsTotal, setAllCollectionsTotal] =
    React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [sortBy, setSortBy] = React.useState<ISortOption>(SORT_OPTIONS[1]); // Default to "Most Endorsed"
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeSearch, setActiveSearch] = React.useState<string>(""); // The search term actually being used
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageInput, setPageInput] = React.useState<string>("1");
  const [selectedTab, setSelectedTab] = React.useState<string>("collections");
  const [refreshTrigger, setRefreshTrigger] = React.useState<number>(0);
  const [searchValidationError, setSearchValidationError] =
    React.useState<string>("");
  const itemsPerPage = 20;
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

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
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleAddCollection = (collection: ICollection) => {
    const revisionNumber =
      collection.latestPublishedRevision?.revisionNumber || "latest";
    // Use the game domain name from the collection data (already converted)
    const nxmUrl = `nxm://${collection.game.domainName}/collections/${collection.slug}/revisions/${revisionNumber}`;

    // Track the download click event
    api.events.emit(
      "analytics-track-mixpanel-event",
      new CollectionsDownloadClickedEvent(collection.slug, collection.game.id),
    );

    if (
      adultContentFilter === false &&
      collection.latestPublishedRevision?.adultContent
    ) {
      adultContentDialog(api, collection, false).then((proceed) => {
        if (proceed) {
          handleViewNexusAdultPreferences();
        }
      });
    } else {
      // Use the Vortex API to handle the NXM link
      api.events.emit(
        "start-download",
        [nxmUrl],
        {},
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

  const handleViewNexusAdultPreferences = () => {
    const nexusUrl = `https://next.nexusmods.com/settings/content-blocking`;
    opn(nexusUrl).catch(() => undefined);
  };

  const handleViewOnNexus = (collection: ICollection) => {
    const nexusUrl = `https://www.nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`;
    opn(nexusUrl).catch(() => undefined);
  };

  React.useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const options: ICollectionSearchOptions = {
      gameId: nexusGameId(getGame(gameId), gameId),
      count: 20,
      offset: (currentPage - 1) * itemsPerPage,
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
        if (
          err.message &&
          err.message.includes("Wildcard value must have 2 or more characters")
        ) {
          const friendlyError = new Error(
            t("collection:browse.searchTooShort"),
          );
          setError(friendlyError);
          // Also clear the invalid search so user can try again
          setActiveSearch("");
        } else {
          setError(err);
        }
        setLoading(false);
      });
  }, [gameId, sortBy, activeSearch, currentPage, api, refreshTrigger]);

  React.useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [sortBy, activeSearch]);

  // Scroll to top when page changes
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const formatFileSize = (bytes: string): string => {
    const size = parseInt(bytes, 10);
    if (isNaN(size)) return "0 MB";
    const mb = size / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
    setPageInput(page.toString());
  };

  const handleGoToPage = () => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleGoToPage();
    }
  };

  if (!gameId) {
    return (
      <MainPage id="browse-collections-page">
        <MainPage.Body>
          <div className="tw:p-5 tw:text-center">
            <p>{t("collection:browse.selectGame")}</p>
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  return (
    <MainPage id="browse-collections-page">
      <MainPage.Body style={{ overflowY: "auto" }}>
        <div
          className="tw:h-full tw:p-5"
          ref={(node) => {
            if (node) {
              scrollContainerRef.current = node.parentElement as HTMLDivElement;
            }
          }}
        >
          <Tailwind.TabProvider
            tab={selectedTab}
            tabListId="browse-nexus-tabs"
            onSetSelectedTab={setSelectedTab}
          >
            <Tailwind.TabBar className="tw:mb-5">
              <Tailwind.TabButton
                count={allCollectionsTotal}
                name={t("collection:browse.tabs.collections")}
              />

              <Tailwind.TabButton name={t("collection:browse.tabs.mods")} />
            </Tailwind.TabBar>

            <Tailwind.TabPanel name={t("collection:browse.tabs.collections")}>
              {/* Search Bar */}
              <div className="tw:flex tw:gap-2.5 tw:mb-4 tw:items-start">
                <Tailwind.Input
                  errorMessage={searchValidationError || undefined}
                  fieldClassName="tw:w-64 tw:shrink-0"
                  hideLabel={true}
                  label={t("collection:browse.searchPlaceholder")}
                  placeholder={t("collection:browse.searchPlaceholder")}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Clear validation error when user types
                    if (searchValidationError) {
                      setSearchValidationError("");
                    }
                  }}
                  onKeyDown={handleKeyDown}
                />

                <Tailwind.Button
                  buttonType="secondary"
                  filled="strong"
                  size="md"
                  onClick={handleSearch}
                >
                  {t("common:actions.search")}
                </Tailwind.Button>

                <Tailwind.Button
                  buttonType="tertiary"
                  filled="weak"
                  leftIconPath={mdiRefresh}
                  size="md"
                  onClick={handleRefresh}
                >
                  {t("collection:browse.refresh")}
                </Tailwind.Button>
              </div>

              {/* Conditional Content */}
              {loading ? (
                <div className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:py-8">
                  <div className="tw:text-center">
                    <Tailwind.Typography
                      appearance="subdued"
                      typographyType="body-lg"
                    >
                      {t("collection:browse.loading")}
                    </Tailwind.Typography>
                  </div>
                </div>
              ) : error ? (
                <div className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:py-8">
                  <div className="tw:text-center">
                    <Tailwind.Typography
                      appearance="none"
                      className="tw:mb-2 tw:text-danger-moderate"
                      typographyType="body-lg"
                    >
                      {t("collection:browse.error")}
                    </Tailwind.Typography>

                    <Tailwind.Typography
                      appearance="subdued"
                      typographyType="body-md"
                    >
                      {error.message}
                    </Tailwind.Typography>
                  </div>
                </div>
              ) : collections.length === 0 ? (
                <div className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:py-8">
                  <div className="tw:text-center">
                    <Tailwind.Typography
                      appearance="subdued"
                      typographyType="body-lg"
                    >
                      {t("collection:browse.noCollections")}
                    </Tailwind.Typography>
                  </div>
                </div>
              ) : (
                <>
                  {/* Results count and sort */}
                  <div className="tw:flex tw:justify-between tw:items-center tw:mb-5">
                    <Tailwind.Typography
                      appearance="moderate"
                      isTranslucent={true}
                      typographyType="body-md"
                    >
                      {t("collection:browse.resultsCount", {
                        total: numeral(totalCount).format("0,0"),
                      })}
                    </Tailwind.Typography>

                    <Tailwind.Select
                      className="tw:flex tw:max-w-64 tw:items-center tw:gap-2.5"
                      hideLabel={true}
                      id="sort-select"
                      label={t("collection:browse.sortBy")}
                      value={SORT_OPTIONS.indexOf(sortBy)}
                      onChange={(e) =>
                        setSortBy(SORT_OPTIONS[parseInt(e.target.value, 10)])
                      }
                    >
                      {SORT_OPTIONS.map((option, index) => (
                        <option key={option.field} value={index}>
                          {option.label}
                        </option>
                      ))}
                    </Tailwind.Select>
                  </div>

                  {/* Collection Tiles */}
                  <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(465px,1fr))] tw:gap-4">
                    {collections.map((collection) => {
                      const tileImage =
                        (collection as any).tileImage?.thumbnailUrl ||
                        "https://placehold.co/166x207/1f1f1f/666?text=No+Image";
                      const latestRevision = (collection as any)
                        .latestPublishedRevision;
                      const tags: string[] = [];

                      // Extract tags from collection - ensure all tags are strings
                      if ((collection as any).category?.name) {
                        tags.push((collection as any).category.name);
                      }
                      if (latestRevision?.adultContent) {
                        tags.push("Adult");
                      }

                      return (
                        <Tailwind.CollectionTile
                          api={api}
                          author={{
                            name: collection.user?.name || "Unknown",
                            avatar: collection.user?.avatar,
                          }}
                          badges={(collection as any).badges}
                          className="tw:max-w-none"
                          coverImage={tileImage}
                          description={
                            (collection as any).summary ||
                            "No description available."
                          }
                          gameId={gameId}
                          id={collection.id.toString()}
                          key={collection.id}
                          slug={collection.slug}
                          stats={{
                            modCount: latestRevision?.modCount || 0,
                            size: latestRevision?.totalSize || 0,
                            endorsements: collection.endorsements || 0,
                          }}
                          tags={tags}
                          title={collection.name}
                          version={latestRevision?.revisionNumber?.toString()}
                          onAddCollection={() =>
                            handleAddCollection(collection)
                          }
                          onViewPage={() => handleViewOnNexus(collection)}
                        />
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="tw:flex tw:items-center tw:justify-start tw:gap-2.5 tw:mt-8 tw:pb-5">
                      {/* Previous Button */}
                      <Tailwind.Button
                        buttonType="tertiary"
                        className=""
                        disabled={currentPage === 1}
                        leftIconPath={mdiChevronLeft}
                        size="md"
                        onClick={handlePreviousPage}
                      />

                      {/* Page Numbers */}
                      <div className="tw:flex tw:gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            // Show first page, last page, current page, and 2 pages on each side of current
                            if (
                              page === 1 ||
                              page === totalPages ||
                              Math.abs(page - currentPage) <= 2
                            ) {
                              return true;
                            }
                            return false;
                          })
                          .map((page, idx, array) => {
                            // Add ellipsis if there's a gap
                            const prevPage = array[idx - 1];
                            const showEllipsis =
                              prevPage && page - prevPage > 1;

                            return (
                              <React.Fragment key={page}>
                                {showEllipsis && (
                                  <span className="tw:px-1 tw:py-2 tw:text-gray-500">
                                    ...
                                  </span>
                                )}

                                <Tailwind.Button
                                  buttonType="tertiary"
                                  className=""
                                  filled={
                                    page === currentPage ? "weak" : undefined
                                  }
                                  size="md"
                                  onClick={() => handlePageClick(page)}
                                >
                                  {page.toString()}
                                </Tailwind.Button>
                              </React.Fragment>
                            );
                          })}
                      </div>

                      {/* Next Button */}
                      <Tailwind.Button
                        buttonType="tertiary"
                        className=""
                        disabled={currentPage === totalPages}
                        leftIconPath={mdiChevronRight}
                        size="md"
                        onClick={handleNextPage}
                      />

                      {/* Direct Page Input */}
                      <div className="tw:flex tw:items-center tw:gap-1 tw:ml-5">
                        <Tailwind.Typography
                          appearance="subdued"
                          typographyType="body-md"
                        >
                          {t("collection:pagination.goTo")}
                        </Tailwind.Typography>

                        <Tailwind.Input
                          className="tw:min-w-10 tw:text-center"
                          hideLabel={true}
                          id="page-input"
                          label={t("collection:pagination.pageNumber")}
                          max={totalPages}
                          min={1}
                          type="number"
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value)}
                          onKeyDown={handlePageInputKeyDown}
                        />

                        <Tailwind.Button
                          buttonType="secondary"
                          filled="weak"
                          size="md"
                          onClick={handleGoToPage}
                        >
                          {t("collection:pagination.go")}
                        </Tailwind.Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Tailwind.TabPanel>

            <Tailwind.TabPanel name={t("collection:browse.tabs.mods")}>
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:py-16">
                {/* Icon */}
                <Tailwind.Icon
                  className="tw:size-9 tw:text-neutral-subdued"
                  path="mdiClockOutline"
                  size="xl"
                />

                {/* Heading */}
                <Tailwind.Typography
                  appearance="subdued"
                  className="tw:font-semibold"
                  typographyType="body-xl"
                >
                  {t("collection:browse.modsComingSoon.title")}
                </Tailwind.Typography>

                {/* Description */}
                <Tailwind.Typography
                  appearance="subdued"
                  className="tw:text-center"
                  typographyType="body-lg"
                >
                  {t("collection:browse.modsComingSoon.description")}
                </Tailwind.Typography>

                {/* Button */}
                <Tailwind.Button
                  buttonType="tertiary"
                  filled="weak"
                  leftIconPath={mdiOpenInNew}
                  size="sm"
                  onClick={() => {
                    const game = getGame(gameId);
                    const domainName = nexusGameId(game, gameId);
                    const nexusUrl = `https://www.nexusmods.com/games/${domainName}/mods`;
                    opn(nexusUrl).catch(() => undefined);
                  }}
                >
                  {t("collection:browse.modsComingSoon.openWebsite")}
                </Tailwind.Button>
              </div>
            </Tailwind.TabPanel>
          </Tailwind.TabProvider>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default BrowseNexusPage;
