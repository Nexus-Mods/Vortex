import { mdiMagnify, mdiOpenInNew, mdiRefresh } from "@mdi/js";
import numeral from "numeral";
import React, { useRef } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { CollectionTile } from "@/ui/components/collection_tile/CollectionTile";
import { CollectionTileSkeleton } from "@/ui/components/collection_tile/CollectionTile.skeleton";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Listing } from "@/ui/components/listing/Listing";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { Picker } from "@/ui/components/picker/Picker";
import { Typography } from "@/ui/components/typography/Typography";
import { PageScroll } from "@/views/components/Page/PageScroll";

import {
  COLLECTIONS_PER_PAGE,
  collectionT,
  type ICollectionSearch,
  SORT_OPTIONS,
} from "../../hooks/use_collection_search/useCollectionSearch.hook";

interface IBrowseCollectionsProps {
  api: IExtensionApi;
  /** The collections, from the page's useCollectionSearch. */
  search: ICollectionSearch;
}

/** The active game's collections, in their own scroll region: searched, sorted, a page at a time, each one to add. */
export const BrowseCollections = ({ api, search }: IBrowseCollectionsProps) => {
  const t = collectionT(api);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    gameDomainName,
    isLoggedIn,
    collections,
    totalCount,
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
  } = search;

  return (
    <PageScroll isFullWidth className="space-y-3 p-6" ref={scrollRef}>
      <form
        className="flex items-start gap-x-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <TextField
          errorMessage={searchValidationError || undefined}
          fieldClassName="max-w-60"
          hideLabel={true}
          label={t("collection:browse.searchPlaceholder")}
          placeholder={t("collection:browse.searchPlaceholder")}
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
          appearance="moderate"
          brand="neutral"
          leftIconPath={mdiMagnify}
          title={t("common:actions.search")}
          type="submit"
        />
      </form>

      <div className="flex justify-between">
        <div className="flex items-center gap-x-2">
          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiRefresh}
            title={t("collection:browse.refresh")}
            onClick={handleRefresh}
          />

          <Typography appearance="moderate" brand="neutral-translucent" typographyType="body-sm">
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
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiOpenInNew}
            onClick={() =>
              window.api.shell.openUrl(`https://www.nexusmods.com/games/${gameDomainName}/mods`)
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
            isLoggedIn={isLoggedIn}
            key={collection.id}
            onAddCollection={() => handleAddCollection(collection)}
            onViewPage={() =>
              window.api.shell.openUrl(
                `https://www.nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`,
              )
            }
          />
        ))}
      </Listing>

      <Pagination
        currentPage={currentPage}
        recordsPerPage={COLLECTIONS_PER_PAGE}
        scrollRef={scrollRef}
        totalRecords={totalCount}
        onPaginationUpdate={(newPage) => setCurrentPage(newPage)}
      />
    </PageScroll>
  );
};
