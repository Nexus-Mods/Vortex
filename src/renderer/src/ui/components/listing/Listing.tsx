import React, {
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from "react";

import type { IIconSource } from "@/ui/components/icon/Icon";
import { ListingLoader } from "@/ui/components/listing_loader/ListingLoader";
import { NoResults } from "@/ui/components/no_results/NoResults";

import { LoadMoreMarker } from "./LoadMoreMarker";

/** How far below the view, in pixels, the end of a list starts loading more. */
const LOAD_MORE_DISTANCE = 320;

export const Listing = ({
  appendLoader,
  children,
  className,
  customError,
  customNoResults,
  entityCount,
  errorIcon,
  errorMessage,
  errorTitle,
  hasMore,
  isError,
  isLoading,
  isLoadingMore,
  isLoadMoreError,
  loadMoreErrorMessage = "More couldn't be loaded. Try again.",
  loadMoreSkeletonCount = 2,
  noResultsClassName = "py-16",
  noResultsIcon = "zoom_out",
  noResultsIconClassName,
  noResultsChildren,
  noResultsMessage = "Try adjusting your filters or search terms.",
  noResultsTitle = "No items found",
  onLoadMore,
  onRetry,
  scrollRef,
  skeletonCount = 4,
  SkeletonTile,
}: PropsWithChildren<{
  /** A placeholder in the shape of an item, drawn while items load. */
  SkeletonTile?: ComponentType<React.PropsWithChildren<unknown>>;
  /** Whether a first load keeps the items shown and draws its tiles after them. */
  appendLoader?: boolean;
  /** Classes for the items' container, such as a grid's. */
  className?: string;
  /** Shown in place of the default error when the items failed to load. */
  customError?: ReactNode;
  /** Shown in place of the default empty state when there are no items. */
  customNoResults?: ReactNode;
  /** How many items there are; none shows the empty state. */
  entityCount?: number;
  /** The error's icon, in place of the default. */
  errorIcon?: IIconSource;
  /** What to say when the items failed to load. */
  errorMessage?: string;
  /** The error's title, for a first load or loading more. */
  errorTitle?: string;
  /** Whether there's more to load after the items shown. */
  hasMore?: boolean;
  /** Whether the items failed to load. */
  isError?: boolean;
  /** Whether the items are loading, drawn as tiles in their place. */
  isLoading?: boolean;
  /** Whether more is loading after the items shown, drawn as tiles after them. */
  isLoadingMore?: boolean;
  /** Whether loading more failed, offering `onRetry` after the items instead of loading more. */
  isLoadMoreError?: boolean;
  /** What to say when loading more failed. */
  loadMoreErrorMessage?: string;
  /** How many tiles stand for what's loading after the items. */
  loadMoreSkeletonCount?: number;
  /** Classes for the empty state and the error. */
  noResultsClassName?: string;
  /** Shown under the empty state's message, such as an action. */
  noResultsChildren?: ReactNode;
  /** The empty state's icon. */
  noResultsIcon?: IIconSource;
  /** Classes for the empty state's icon. */
  noResultsIconClassName?: string;
  /** What the empty state says. */
  noResultsMessage?: string;
  /** The empty state's title. */
  noResultsTitle?: string;
  /** Asks for more, as the end of the items nears the view while `hasMore`. */
  onLoadMore?: () => void;
  /** Asks again for what failed, the items or more of them; offers Try again when given. */
  onRetry?: () => void;
  /** The element the list scrolls in, which loading more watches; the window's view without one. */
  scrollRef?: RefObject<HTMLElement>;
  /** How many tiles stand for the items while they load. */
  skeletonCount?: number;
}>) => {
  if (isLoading || !!entityCount) {
    const canLoadMore = !isLoading && hasMore && !isLoadingMore && !isLoadMoreError;

    return (
      <>
        <ListingLoader
          append={isLoading ? appendLoader : true}
          className={className}
          isLoading={isLoading || isLoadingMore}
          skeletonCount={isLoading ? skeletonCount : loadMoreSkeletonCount}
          SkeletonTile={SkeletonTile}
        >
          {children}
        </ListingLoader>

        {canLoadMore && !!onLoadMore && (
          <LoadMoreMarker
            distance={LOAD_MORE_DISTANCE}
            scrollRef={scrollRef}
            onVisible={onLoadMore}
          />
        )}

        {!isLoading && !isLoadingMore && isLoadMoreError && (
          <NoResults
            className="py-6"
            isError={true}
            message={loadMoreErrorMessage}
            title={errorTitle}
            onRetry={onRetry}
          />
        )}
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
            onRetry={onRetry}
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
