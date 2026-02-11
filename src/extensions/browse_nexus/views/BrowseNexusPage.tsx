import type {
  ICollection,
  ICollectionSearchOptions,
  CollectionSortField,
  SortDirection,
} from "@nexusmods/nexus-api";

import { mdiMagnify, mdiOpenInNew, mdiRefresh } from "@mdi/js";
import numeral from "numeral";
import * as React from "react";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";

import MainPage from "../../../renderer/views/MainPage";
import Tailwind from "../../../tailwind";
import { Button } from "../../../tailwind/components/next/button";
import { Input } from "../../../tailwind/components/next/form";
import {
  TabBar,
  TabButton,
  TabPanel,
  TabProvider,
} from "../../../tailwind/components/next/tabs";
import { Typography } from "../../../tailwind/components/next/typography";
import { Pagination } from "../../../tailwind/components/pagination/Pagination";
import { Picker } from "../../../tailwind/components/picker";
import { UserCanceled } from "../../../util/api";
import opn from "../../../util/opn";
import { activeGameId } from "../../../util/selectors";
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
  const [selectedTab, setSelectedTab] = React.useState<string>("collections");
  const [refreshTrigger, setRefreshTrigger] = React.useState<number>(0);
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
  }, [sortBy, activeSearch]);

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
      <MainPage.Body className="h-full overflow-y-auto pt-6">
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
                onSubmit={() => handleSearch()}
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

                  <Typography appearance="moderate" isTranslucent={true}>
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
                  onChange={(value) => setSortBy(value)}
                />
              </div>

              {loading ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-center">
                    <Tailwind.Typography
                      appearance="subdued"
                      typographyType="body-lg"
                    >
                      {t("collection:browse.loading")}
                    </Tailwind.Typography>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-center">
                    <Tailwind.Typography
                      appearance="none"
                      className="mb-2 text-danger-moderate"
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
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-center">
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
                  {/* Collection Tiles */}
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(465px,1fr))] gap-4">
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
                          className="max-w-none"
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
                </>
              )}

              <Pagination
                currentPage={currentPage}
                recordsPerPage={itemsPerPage}
                totalRecords={totalCount}
                onPaginationUpdate={(newPage) => setCurrentPage(newPage)}
              />
            </div>
          </TabPanel>

          <TabPanel name={t("collection:browse.tabs.mods")}>
            <div className="flex flex-col items-center gap-4 py-16">
              {/* Icon */}
              <Tailwind.Icon
                className="size-9 text-neutral-subdued"
                path="mdiClockOutline"
                size="xl"
              />

              {/* Heading */}
              <Tailwind.Typography
                appearance="subdued"
                className="font-semibold"
                typographyType="body-xl"
              >
                {t("collection:browse.modsComingSoon.title")}
              </Tailwind.Typography>

              {/* Description */}
              <Tailwind.Typography
                appearance="subdued"
                className="text-center"
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
          </TabPanel>
        </TabProvider>
      </MainPage.Body>
    </MainPage>
  );
}

export default BrowseNexusPage;
