import * as React from "react";

import { TextField } from "@/ui/components/form/text_field/TextField";
import { Icon } from "@/ui/components/icon/Icon";
import { Listing } from "@/ui/components/listing/Listing";
import type { ListingStatus } from "@/ui/components/listing/listing_status/listingStatus";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";

import useCategoryTree from "../hooks/CategoryTreeHook";
import { CategoryAddParent } from "./CategoryAddParent";
import CustomCategoryFetchError from "./CategoryListFetchError";
import CategoryListItem, { CategoryListSkeletonTile } from "./CategoryListItem";
import CustomNoCategoryResults from "./CategoryListNoResults";

interface IListStatusOptions {
  /** Whether the categories are being fetched from Nexus Mods. */
  isFetching: boolean;
  /** Whether the last fetch failed. */
  isFetchError: boolean;
  /** How many categories there are to show. */
  count: number;
}

/** Loading while it fetches; failed only with no categories to show, as those stay on screen. */
const listStatus = ({ isFetching, isFetchError, count }: IListStatusOptions): ListingStatus => {
  if (isFetching) {
    return "loading";
  }

  if (isFetchError && !count) {
    return "failed";
  }

  return "done";
};

/**
 * displays the list of categories related for the current game.
 *
 */
export default function CategoryList() {
  const {
    t,
    searchString,
    setSearchString,
    filteredTreeData,
    toolbarActions,
    toggleExpand,
    createCategory,
    removeCategory,
    moveCategory,
    fetchError,
    isFetchError,
    isFetching,
    importCategoriesFromNexusMods,
    addParentVisible,
    startCreateParentCategory,
    newParentCategoryName,
    setNewParentCategoryName,
    clearFetchError,
    onRenameCategory,
  } = useCategoryTree();

  const categoryCount = filteredTreeData?.length ?? 0;

  const fetch = () => {
    if (isFetching) return;
    importCategoriesFromNexusMods().catch(() => undefined);
  };

  return (
    <div className="categories-dialog">
      <Toolbar>
        <ToolbarGroup actions={toolbarActions} />
      </Toolbar>

      <div className="my-2 flex items-center gap-2">
        <Icon className="nxm-neutral" name="search" />

        <TextField
          hideLabel
          className="h-full grow"
          label="Filter categories"
          placeholder="Filter categories..."
          type="text"
          value={searchString}
          onChange={(e) => setSearchString(e.target.value)}
        />
      </div>

      <div className="min-h-[50dvh]s my-2 max-h-[75dvh] overflow-auto">
        <CategoryAddParent
          create={createCategory}
          newName={newParentCategoryName}
          setNewName={setNewParentCategoryName}
          t={t}
          toggle={() => startCreateParentCategory(!addParentVisible)}
          visible={addParentVisible}
        />

        <Listing
          className="grid grid-cols-1 gap-2 space-y-2"
          customError={
            <CustomCategoryFetchError
              clear={clearFetchError}
              error={fetchError}
              fetch={fetch}
              t={t}
            />
          }
          customNoResults={
            <CustomNoCategoryResults
              create={startCreateParentCategory}
              fetch={fetch}
              searchTerm={searchString}
              t={t}
            />
          }
          entityCount={categoryCount}
          skeletonCount={10}
          SkeletonTile={CategoryListSkeletonTile}
          status={listStatus({
            isFetching,
            isFetchError,
            count: categoryCount,
          })}
        >
          {filteredTreeData?.map((c) => (
            <CategoryListItem
              category={c}
              createSubcategory={createCategory}
              expand={toggleExpand}
              key={c.categoryId}
              moveCategory={moveCategory}
              remove={removeCategory}
              renameCategory={onRenameCategory}
              t={t}
            />
          ))}
        </Listing>
      </div>
    </div>
  );
}
