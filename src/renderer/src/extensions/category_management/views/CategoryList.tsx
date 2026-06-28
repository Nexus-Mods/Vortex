import { mdiMagnify } from "@mdi/js";
import * as React from "react";

import { Input } from "@/ui/components/form/input/Input";
import { Icon as MdiIcon } from "@/ui/components/icon/Icon";
import { Listing } from "@/ui/components/listing/Listing";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";

import useCategoryTree from "../hooks/CategoryTreeHook";
import { CategoryAddParent } from "./CategoryAddParent";
import CustomCategoryFetchError from "./CategoryListFetchError";
import CategoryListItem, { CategoryListSkeletonTile } from "./CategoryListItem";
import CustomNoCategoryResults from "./CategoryListNoResults";
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
        <MdiIcon className="nxm-neutral" path={mdiMagnify} />

        <Input
          hideLabel
          className="h-full grow"
          id="size-sm-search-categories"
          placeholder="Filter categories..."
          size="sm"
          type="text"
          value={searchString}
          onChange={(e) => setSearchString(e.target.value)}
        />
      </div>

      <div className="my-2 max-h-[calc(dvh*0.75)] overflow-auto">
        <CategoryAddParent
          create={createCategory}
          newName={newParentCategoryName}
          setNewName={setNewParentCategoryName}
          toggle={() => startCreateParentCategory(!addParentVisible)}
          visible={addParentVisible}
        />

        <Listing
          className="grid min-h-[calc(dvh*0.5)] grid-cols-1 gap-2"
          customError={
            <CustomCategoryFetchError clear={clearFetchError} error={fetchError} fetch={fetch} />
          }
          customNoResults={
            <CustomNoCategoryResults
              create={startCreateParentCategory}
              fetch={fetch}
              searchTerm={searchString}
            />
          }
          entityCount={filteredTreeData?.length ?? 0}
          isError={isFetchError}
          isLoading={isFetching}
          skeletonCount={10}
          SkeletonTile={CategoryListSkeletonTile}
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
