/**
 * Listing Demo Component
 * Demonstrates the Listing component states and features
 */

import React, { useRef, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { Listing } from "./Listing";
import { type ListingStatus, PAGES_BEFORE_PAUSE } from "./listing_status/listingStatus";

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

/** The loading-more example's status once it has this many items: paused, idle or done. */
const nextStatus = (count: number): ListingStatus => {
  if (count >= MORE_TOTAL) {
    return "done";
  }

  if ((count / MORE_START) % PAGES_BEFORE_PAUSE === 0) {
    return "paused";
  }

  return "idle";
};

/** Every status, for the interactive example's buttons. */
const STATUSES: ListingStatus[] = [
  "loading",
  "failed",
  "loading_more",
  "load_more_failed",
  "idle",
  "paused",
  "done",
];

/**
 * A list in its own scroller that loads six more items, a page, as its end nears, until there are
 * 30. It pauses every `PAGES_BEFORE_PAUSE` pages until Load more is clicked. Reset goes back to the
 * first six, at the top, cancelling a load still on its way.
 */
const LoadMoreExample = () => {
  const [count, setCount] = useState(MORE_START);
  const [status, setStatus] = useState<ListingStatus>("idle");
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(failNext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef<ReturnType<typeof setTimeout>>();
  failNextRef.current = failNext;

  const loadMore = () => {
    setStatus("loading_more");
    loadRef.current = setTimeout(() => {
      if (failNextRef.current) {
        setFailNext(false);
        setStatus("load_more_failed");
        return;
      }

      const next = Math.min(count + MORE_START, MORE_TOTAL);
      setCount(next);
      setStatus(nextStatus(next));
    }, 800);
  };

  const reset = () => {
    clearTimeout(loadRef.current);
    setCount(MORE_START);
    setStatus("idle");
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
          loadMoreLabel="Load more items"
          loadMoreSummary={`Showing ${count} of ${MORE_TOTAL} items`}
          scrollRef={scrollRef}
          SkeletonTile={SkeletonTile}
          status={status}
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
  const [status, setStatus] = useState<ListingStatus>("done");
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
          Pick a status to see what Listing draws for it, with the items or with none.
        </Typography>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((option) => (
            <Button
              appearance={option === status ? "strong" : "subdued"}
              brand="neutral"
              key={option}
              onClick={() => setStatus(option)}
            >
              {option}
            </Button>
          ))}

          <Button
            appearance={isEmpty ? "strong" : "subdued"}
            brand="neutral"
            onClick={() => setIsEmpty(!isEmpty)}
          >
            {isEmpty ? "Items: None" : "Items: Six"}
          </Button>
        </div>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4"
            entityCount={visibleItems.length}
            skeletonCount={6}
            SkeletonTile={SkeletonTile}
            status={status}
            onLoadMore={() => setStatus("loading_more")}
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
          Load More Footer
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          While paused, loadMoreFooter is drawn under the Load more button, such as a prompt for
          feedback.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4"
            entityCount={3}
            loadMoreFooter={
              <Typography appearance="subdued" typographyType="body-sm">
                How&apos;s the browsing experience?
              </Typography>
            }
            loadMoreSummary="Showing 3 of 30 items"
            SkeletonTile={SkeletonTile}
            status="paused"
            onLoadMore={() => undefined}
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
          Every few pages it&apos;s paused instead: Load more, with loadMoreLabel and a
          loadMoreSummary over it, asks for the next page, and loading as it scrolls picks up again.
          getListingStatus turns a React Query result into a status, pausing it.
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
