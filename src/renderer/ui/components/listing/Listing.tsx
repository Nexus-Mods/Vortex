import { mdiMagnifyRemoveOutline } from "@mdi/js";
import React, {
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
} from "react";

import { ListingLoader } from "../listing_loader/ListingLoader";
import { NoResults } from "../no_results/NoResults";

export const Listing = ({
  additionalContent,
  appendLoader,
  children,
  className,
  customError,
  customNoResults,
  entityCount,
  errorIconPath,
  errorMessage,
  errorTitle,
  isError,
  isLoading,
  noResultsClassName = "py-16",
  noResultsIconPath,
  noResultsChildren,
  noResultsMessage = "Try adjusting your filters or search terms.",
  noResultsTitle = "No items found",
  skeletonCount = 4,
  SkeletonTile,
}: PropsWithChildren<{
  SkeletonTile: ComponentType;
  additionalContent?: ReactNode;
  appendLoader?: boolean;
  className?: string;
  customError?: ReactNode;
  customNoResults?: ReactNode;
  entityCount?: number;
  errorIconPath?: string;
  errorMessage?: string;
  errorTitle?: string;
  isError?: boolean;
  isLoading?: boolean;
  noResultsClassName?: string;
  noResultsChildren?: ReactNode;
  noResultsIconPath?: string;
  noResultsMessage?: string;
  noResultsTitle?: string;
  skeletonCount?: number;
}>) => {
  if (isLoading || !!entityCount) {
    return (
      <>
        <ListingLoader
          append={appendLoader}
          className={className}
          isLoading={isLoading}
          skeletonCount={skeletonCount}
          SkeletonTile={SkeletonTile}
        >
          {children}
        </ListingLoader>

        {!isLoading && additionalContent}
      </>
    );
  }

  if (isError) {
    return (
      <>
        {customError ?? (
          <NoResults
            className={noResultsClassName}
            iconPath={errorIconPath}
            isError={true}
            message={errorMessage}
            title={errorTitle}
          />
        )}
      </>
    );
  }

  return (
    <>
      {customNoResults ?? (
        <NoResults
          className={noResultsClassName}
          iconPath={noResultsIconPath ?? mdiMagnifyRemoveOutline}
          message={noResultsMessage}
          title={noResultsTitle}
        >
          {noResultsChildren}
        </NoResults>
      )}
    </>
  );
};
