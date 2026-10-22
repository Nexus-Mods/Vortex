import React, { type ComponentType, type PropsWithChildren, type ReactNode } from "react";

import type { IIconSource } from "@/ui/components/icon/Icon";
import { ListingLoader } from "@/ui/components/listing_loader/ListingLoader";
import { NoResults } from "@/ui/components/no_results/NoResults";

export const Listing = ({
  additionalContent,
  appendLoader,
  children,
  className,
  customError,
  customNoResults,
  entityCount,
  errorIcon,
  errorMessage,
  errorTitle,
  isError,
  isLoading,
  noResultsClassName = "py-16",
  noResultsIcon = "zoom_out",
  noResultsIconClassName,
  noResultsChildren,
  noResultsMessage = "Try adjusting your filters or search terms.",
  noResultsTitle = "No items found",
  skeletonCount = 4,
  SkeletonTile,
}: PropsWithChildren<{
  SkeletonTile?: ComponentType<React.PropsWithChildren<unknown>>;
  additionalContent?: ReactNode;
  appendLoader?: boolean;
  className?: string;
  customError?: ReactNode;
  customNoResults?: ReactNode;
  entityCount?: number;
  errorIcon?: IIconSource;
  errorMessage?: string;
  errorTitle?: string;
  isError?: boolean;
  isLoading?: boolean;
  noResultsClassName?: string;
  noResultsChildren?: ReactNode;
  noResultsIcon?: IIconSource;
  noResultsIconClassName?: string;
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
            icon={errorIcon}
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
          icon={noResultsIcon}
          iconClassName={noResultsIconClassName}
          message={noResultsMessage}
          title={noResultsTitle}
        >
          {noResultsChildren}
        </NoResults>
      )}
    </>
  );
};
