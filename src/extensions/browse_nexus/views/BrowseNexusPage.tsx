import type {
  ICollection,
  ICollectionSearchOptions,
  CollectionSortField,
  SortDirection,
} from "@nexusmods/nexus-api";

import { mdiClockOutline, mdiMagnify, mdiOpenInNew, mdiRefresh } from "@mdi/js";
import numeral from "numeral";
import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import type { IState } from "../../../renderer/types/IState";

import { Listing } from "../../../renderer/tailwind/components/listing";
import { Button } from "../../../renderer/tailwind/components/next/button";
import {
  CollectionTile,
  CollectionTileSkeleton,
} from "../../../renderer/tailwind/components/next/collectiontile";
import { Input } from "../../../renderer/tailwind/components/next/form";
import {
  TabBar,
  TabButton,
  TabPanel,
  TabProvider,
} from "../../../renderer/tailwind/components/next/tabs";
import { Typography } from "../../../renderer/tailwind/components/next/typography";
import { NoResults } from "../../../renderer/tailwind/components/no_results";
import { Pagination } from "../../../renderer/tailwind/components/pagination/Pagination";
import { Picker } from "../../../renderer/tailwind/components/picker";
import { UserCanceled } from "../../../renderer/util/api";
import { getPreloadApi } from "../../../renderer/util/preloadAccess";
import { activeGameId } from "../../../renderer/util/selectors";
import MainPage from "../../../renderer/views/MainPage";
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

  const scrollRef = useRef<HTMLDivElement>(null);

  const gameId = useSelector((state: IState) => activeGameId(state));
  const gameDomainName = nexusGameId(getGame(gameId), gameId);

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
  const [selectedTab, setSelectedTab] = useState<string>("collections");
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [searchValidationError, setSearchValidationError] =
    React.useState<string>("");
  const itemsPerPage = 20;

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
          getPreloadApi().shell.openUrl(
            "https://next.nexusmods.com/settings/content-blocking",
          );
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

  if (!gameId) {
    return (
      <MainPage id="browse-collections-page">
        <MainPage.Body>
          <div className="p-5 text-center">
            <p>{t("collection:browse.selectGame")}</p>
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  return (
    <MainPage id="browse-collections-page">
      <MainPage.Body className="h-full overflow-y-auto pt-6" ref={scrollRef}>
        <TabProvider
          tab={selectedTab}
          tabListId="browse-nexus-tabs"
          onSetSelectedTab={setSelectedTab}
        >
          <TabBar className="pl-6" size="sm">
            <TabButton
              count={allCollectionsTotal}
              name={t("collection:browse.tabs.collections")}
            />

            <TabButton name={t("collection:browse.tabs.mods")} />
          </TabBar>

          <TabPanel name={t("collection:browse.tabs.collections")}>
            <div className="space-y-3 p-6">
              <form
                className="flex items-center gap-x-2"
                onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              >
                <Input
                  errorMessage={searchValidationError || undefined}
                  fieldClassName="max-w-60"
                  hideLabel={true}
                  label={t("collection:browse.searchPlaceholder")}
                  placeholder={t("collection:browse.searchPlaceholder")}
                  size="sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);

                    // Clear validation error when user types
                    if (searchValidationError) {
                      setSearchValidationError("");
                    }
                  }}
                />

                <Button
                  as="button"
                  buttonType="tertiary"
                  filled="weak"
                  leftIconPath={mdiMagnify}
                  size="sm"
                  title={t("common:actions.search")}
                  type="submit"
                />
              </form>

              <div className="flex justify-between">
                <div className="flex items-center gap-x-2">
                  <Button
                    buttonType="tertiary"
                    filled="weak"
                    leftIconPath={mdiRefresh}
                    size="sm"
                    title={t("collection:browse.refresh")}
                    onClick={handleRefresh}
                  />

                  <Typography
                    appearance="moderate"
                    isTranslucent={true}
                    typographyType="body-sm"
                  >
                    {t("collection:browse.resultsCount", {
                      total: numeral(totalCount).format("0,0"),
                    })}
                  </Typography>
                </div>

                <Picker
                  options={SORT_OPTIONS.map((option) => ({
                    label: option.label,
                    value: option,
                  }))}
                  value={sortBy}
                  onChange={(value) => {
                    setSortBy(value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <Listing
                className="grid grid-cols-[repeat(auto-fit,minmax(26rem,1fr))] gap-4"
                entityCount={collections?.length}
                isError={!!error}
                isLoading={loading}
                noResultsChildren={
                  <Button
                    buttonType="tertiary"
                    filled="weak"
                    leftIconPath={mdiOpenInNew}
                    size="sm"
                    onClick={() =>
                      getPreloadApi().shell.openUrl(
                        `https://www.nexusmods.com/games/${gameDomainName}/mods`,
                      )
                    }
                  >
                    {t("collection:browse.modsComingSoon.openWebsite")}
                  </Button>
                }
                noResultsMessage={t("collection:browse.noCollections.message")}
                noResultsTitle={t("collection:browse.noCollections.title")}
                skeletonCount={12}
                SkeletonTile={CollectionTileSkeleton}
              >
                {collections?.map((collection) => (
                  <CollectionTile
                    api={api}
                    collection={collection}
                    key={collection.id}
                    onAddCollection={() => handleAddCollection(collection)}
                    onViewPage={() =>
                      getPreloadApi().shell.openUrl(
                        `https://www.nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`,
                      )
                    }
                  />
                ))}
              </Listing>

              <Pagination
                currentPage={currentPage}
                recordsPerPage={itemsPerPage}
                scrollRef={scrollRef}
                totalRecords={totalCount}
                onPaginationUpdate={(newPage) => setCurrentPage(newPage)}
              />
            </div>
          </TabPanel>

          <TabPanel name={t("collection:browse.tabs.mods")}>
            <NoResults
              className="py-16"
              iconPath={mdiClockOutline}
              message={t("collection:browse.modsComingSoon.description")}
              title={t("collection:browse.modsComingSoon.title")}
            >
              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath={mdiOpenInNew}
                size="sm"
                onClick={() =>
                  getPreloadApi().shell.openUrl(
                    `https://www.nexusmods.com/games/${gameDomainName}/mods`,
                  )
                }
              >
                {t("collection:browse.modsComingSoon.openWebsite")}
              </Button>
            </NoResults>
          </TabPanel>
        </TabProvider>
      </MainPage.Body>
    </MainPage>
  );
}

export default BrowseNexusPage;
