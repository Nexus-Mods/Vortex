import React, {
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from "react";

import { Button } from "@/ui/components/button/Button";
import type { IIconSource } from "@/ui/components/icon/Icon";
import { ListingLoader } from "@/ui/components/listing_loader/ListingLoader";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Typography } from "@/ui/components/typography/Typography";

import type { ListingStatus, LoadMoreSource } from "./listing_status/listingStatus";
import { LoadMoreMarker } from "./LoadMoreMarker";

/** How far below the view, in pixels, the end of a list starts loading more. */
const LOAD_MORE_DISTANCE = 320;

export const Listing = ({
  children,
  className,
  customError,
  customNoResults,
  entityCount,
  errorIcon,
  errorMessage,
  errorTitle,
  loadMoreErrorMessage = "More couldn't be loaded. Try again.",
  loadMoreFooter,
  loadMoreLabel = "Load more",
  loadMoreNote,
  loadMoreRef,
  loadMoreSkeletonCount = 2,
  loadMoreSummary,
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
  status = "done",
}: PropsWithChildren<{
  /** A placeholder in the shape of an item, drawn while items load. */
  SkeletonTile?: ComponentType<React.PropsWithChildren<unknown>>;
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
  /** What to say when loading more failed. */
  loadMoreErrorMessage?: string;
  /** Shown under the Load more button, while paused. */
  loadMoreFooter?: ReactNode;
  /** The Load more button's label, while paused. */
  loadMoreLabel?: string;
  /** A line over the summary, while paused, such as a nudge after a long time loading. */
  loadMoreNote?: string;
  /** The Load more button, while paused, for the list's keys to move focus to. */
  loadMoreRef?: RefObject<HTMLButtonElement>;
  /** How many tiles stand for what's loading after the items. */
  loadMoreSkeletonCount?: number;
  /** A line over the Load more button, while paused, such as how many have loaded. */
  loadMoreSummary?: string;
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
  /** Asks for more: as the items' end nears the view while `idle`, or from Load more while `paused`. */
  onLoadMore?: (source: LoadMoreSource) => void;
  /** Asks again for what failed, the items or more of them; offers Try again when given. */
  onRetry?: () => void;
  /** The element the list scrolls in, which loading more watches; the window's view without one. */
  scrollRef?: RefObject<HTMLElement>;
  /** How many tiles stand for the items while they load. */
  skeletonCount?: number;
  /** Where its loading is; `done` without one, for a list that's always loaded. */
  status?: ListingStatus;
}>) => {
  if (status === "loading") {
    return (
      <ListingLoader
        isLoading
        className={className}
        skeletonCount={skeletonCount}
        SkeletonTile={SkeletonTile}
      />
    );
  }

  if (status === "failed") {
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

  if (entityCount) {
    return (
      <>
        <ListingLoader
          append
          className={className}
          isLoading={status === "loading_more"}
          skeletonCount={loadMoreSkeletonCount}
          SkeletonTile={SkeletonTile}
        >
          {children}
        </ListingLoader>

        {status === "idle" && !!onLoadMore && (
          <LoadMoreMarker
            distance={LOAD_MORE_DISTANCE}
            scrollRef={scrollRef}
            onVisible={() => onLoadMore("scroll")}
          />
        )}

        {status === "paused" && !!onLoadMore && (
          <div className="flex flex-col items-center gap-y-3 border-t border-stroke-weak px-3 py-4">
            {(!!loadMoreNote || !!loadMoreSummary) && (
              <Typography
                appearance="moderate"
                as="div"
                brand="neutral-translucent"
                className="space-y-3 text-center"
                typographyType="body-sm"
              >
                {!!loadMoreNote && <p data-testid="listing-load-more-note">{loadMoreNote}</p>}

                {!!loadMoreSummary && (
                  <p data-testid="listing-load-more-summary">{loadMoreSummary}</p>
                )}
              </Typography>
            )}

            <Button
              data-testid="listing-load-more"
              ref={loadMoreRef}
              onClick={() => onLoadMore("button")}
            >
              {loadMoreLabel}
            </Button>

            {loadMoreFooter}
          </div>
        )}

        {status === "load_more_failed" && (
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
