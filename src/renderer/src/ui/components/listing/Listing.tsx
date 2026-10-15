import React, { type ComponentType, type PropsWithChildren, type ReactNode } from "react";

import type { ISymbolSource } from "@/ui/components/icon/Icon";
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
  errorIconPath,
  errorMessage,
  errorSymbol,
  errorTitle,
  isError,
  isLoading,
  noResultsClassName = "py-16",
  noResultsIconClassName,
  noResultsIconPath,
  noResultsSymbol,
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
  errorIconPath?: string;
  errorSymbol?: ISymbolSource;
  errorMessage?: string;
  errorTitle?: string;
  isError?: boolean;
  isLoading?: boolean;
  noResultsClassName?: string;
  noResultsChildren?: ReactNode;
  noResultsIconClassName?: string;
  noResultsIconPath?: string;
  noResultsSymbol?: ISymbolSource;
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
            symbol={errorSymbol}
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
          iconClassName={noResultsIconClassName}
          iconPath={noResultsIconPath}
          message={noResultsMessage}
          symbol={noResultsIconPath ? undefined : (noResultsSymbol ?? "zoom_out")}
          title={noResultsTitle}
        >
          {noResultsChildren}
        </NoResults>
      )}
    </>
  );
};
