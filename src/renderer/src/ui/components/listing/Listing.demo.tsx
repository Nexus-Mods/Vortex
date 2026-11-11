/**
 * Listing Demo Component
 * Demonstrates the Listing component states and features
 */

import React, { useRef, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { Listing } from "./Listing";
import type { ListingStatus } from "./listing_status/listingStatus";

const SkeletonTile = () => (
  <div className="animate-pulse space-y-2.5 rounded-sm bg-surface-high p-4">
    <div className="h-4 w-1/4 rounded-sm bg-surface-mid" />

    <div className="h-3 w-1/2 rounded-sm bg-surface-mid" />
  </div>
);

const ExampleTile = ({ title }: { title: string }) => (
  <div className="rounded-sm border border-stroke-weak bg-surface-mid p-4">
    <Typography typographyType="body-md">{title}</Typography>

    <Typography appearance="subdued" typographyType="body-sm">
      Example list item content
    </Typography>
  </div>
);

const items = [
  "First Item",
  "Second Item",
  "Third Item",
  "Fourth Item",
  "Fifth Item",
  "Sixth Item",
];

/** How many items the loading-more example ends at. */
const MORE_TOTAL = 30;

/** How many items the loading-more example starts with, and goes back to on reset. */
const MORE_START = 6;

interface ILoadMoreStatusOptions {
  /** Whether more items are loading. */
  isLoadingMore: boolean;
  /** Whether loading more failed. */
  isLoadMoreError: boolean;
  /** How many items it has. */
  count: number;
}

/** The loading-more example's status, from what it's doing and how many items it has. */
const loadMoreStatus = ({
  isLoadingMore,
  isLoadMoreError,
  count,
}: ILoadMoreStatusOptions): ListingStatus => {
  if (isLoadingMore) {
    return "loading_more";
  }

  if (isLoadMoreError) {
    return "load_more_failed";
  }

  return count < MORE_TOTAL ? "idle" : "done";
};

interface IToggledStatusOptions {
  /** Whether the Loading toggle is on. */
  isLoading: boolean;
  /** Whether the Error toggle is on. */
  isError: boolean;
}

/** The interactive example's status, from its toggles. */
const toggledStatus = ({ isLoading, isError }: IToggledStatusOptions): ListingStatus => {
  if (isLoading) {
    return "loading";
  }

  return isError ? "failed" : "done";
};

/**
 * A list in its own scroller that loads six more items as its end nears, until there are 30. Reset
 * goes back to the first six, at the top, cancelling a load still on its way.
 */
const LoadMoreExample = () => {
  const [count, setCount] = useState(MORE_START);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadMoreError, setIsLoadMoreError] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(failNext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef<ReturnType<typeof setTimeout>>();
  failNextRef.current = failNext;

  const loadMore = () => {
    setIsLoadingMore(true);
    setIsLoadMoreError(false);
    loadRef.current = setTimeout(() => {
      setIsLoadingMore(false);

      if (failNextRef.current) {
        setFailNext(false);
        setIsLoadMoreError(true);
        return;
      }

      setCount((current) => Math.min(current + 6, MORE_TOTAL));
    }, 800);
  };

  const reset = () => {
    clearTimeout(loadRef.current);
    setCount(MORE_START);
    setIsLoadingMore(false);
    setIsLoadMoreError(false);
    setFailNext(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-x-2">
        <Button appearance="subdued" brand="neutral" onClick={() => setFailNext(true)}>
          {failNext ? "The next load will fail" : "Fail the next load"}
        </Button>

        <Button appearance="subdued" brand="neutral" onClick={reset}>
          Reset
        </Button>
      </div>

      <div
        className="h-80 overflow-y-auto rounded-sm border border-stroke-weak p-4"
        ref={scrollRef}
      >
        <Listing
          className="flex flex-col gap-y-2"
          entityCount={count}
          errorTitle="Something went wrong"
          loadMoreErrorMessage="More items couldn't be loaded. Try again."
          scrollRef={scrollRef}
          SkeletonTile={SkeletonTile}
          status={loadMoreStatus({ isLoadingMore, isLoadMoreError, count })}
          onLoadMore={loadMore}
          onRetry={loadMore}
        >
          {Array.from({ length: count }, (_, index) => (
            <ExampleTile key={index} title={`Item ${index + 1}`} />
          ))}
        </Listing>
      </div>
    </div>
  );
};

export const ListingDemo = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  const visibleItems = isEmpty ? [] : items;

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Listing
        </Typography>

        <Typography appearance="subdued">
          Container that manages loading, error, and empty states for lists of content. Provide a
          SkeletonTile component and the Listing handles state transitions automatically.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Interactive Demo
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Toggle the state controls to see how Listing handles each scenario.
        </Typography>

        <div className="flex flex-wrap gap-2">
          <Button
            brand="neutral"
            appearance="subdued"
            {...(isLoading ? { appearance: "strong" } : {})}
            onClick={() => {
              setIsLoading(!isLoading);
              setIsError(false);
            }}
          >
            {isLoading ? "Loading: On" : "Loading: Off"}
          </Button>

          <Button
            brand="neutral"
            appearance="subdued"
            {...(isError ? { appearance: "strong" } : {})}
            onClick={() => {
              setIsError(!isError);
              setIsLoading(false);
            }}
          >
            {isError ? "Error: On" : "Error: Off"}
          </Button>

          <Button
            brand="neutral"
            appearance="subdued"
            {...(isEmpty ? { appearance: "strong" } : {})}
            onClick={() => {
              setIsEmpty(!isEmpty);
              setIsError(false);
              setIsLoading(false);
            }}
          >
            {isEmpty ? "Empty: On" : "Empty: Off"}
          </Button>
        </div>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4"
            entityCount={visibleItems.length}
            skeletonCount={6}
            SkeletonTile={SkeletonTile}
            status={toggledStatus({ isLoading, isError })}
          >
            {visibleItems.map((title) => (
              <ExampleTile key={title} title={title} />
            ))}
          </Listing>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Loading More Tiles
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          While the status is loading_more, the items stay on screen and loadMoreSkeletonCount tiles
          are drawn after them. Default is 2.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4"
            entityCount={3}
            loadMoreSkeletonCount={3}
            SkeletonTile={SkeletonTile}
            status="loading_more"
          >
            {items.slice(0, 3).map((title) => (
              <ExampleTile key={title} title={title} />
            ))}
          </Listing>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Skeleton Count
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          The skeletonCount prop controls how many placeholder tiles appear during loading. Default
          is 4.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4"
            skeletonCount={8}
            SkeletonTile={SkeletonTile}
            status="loading"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Loading More
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          For a list that loads a page at a time, such as an infinite query: while its status is
          idle, with onLoadMore, the Listing asks for more as the end of the items comes within
          320px of its scroller&apos;s view. loading_more draws tiles after the items while more
          load, and load_more_failed offers onRetry after them, keeping the items already shown.
          getListingStatus turns a React Query result into a status.
        </Typography>

        <LoadMoreExample />
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Custom Error
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Use the errorTitle and errorMessage props to display API errors or other failure messages.
          The default error icon and "Contact support" link are shown automatically when the status
          is failed.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            entityCount={0}
            errorMessage="GET /v2/collections returned 503: The server is temporarily unavailable. Please try again later."
            errorTitle="Failed to load collections"
            SkeletonTile={SkeletonTile}
            status="failed"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Design Notes
        </Typography>

        <Typography appearance="subdued" as="ul" className="list-inside list-disc space-y-2">
          <li>
            Listing draws what its status says: loading, failed, or the items with more loading,
            failed, left to load or done; with no items once done, the no results state
          </li>

          <li>
            SkeletonTile is a required prop — provide a component that matches the shape of your
            content tiles
          </li>

          <li>
            The className prop is passed to the grid container, so layout classes like CSS grid work
            directly
          </li>

          <li>Use customError or customNoResults to fully override the default empty states</li>
        </Typography>
      </div>
    </div>
  );
};
