/**
 * Listing Demo Component
 * Demonstrates the Listing component states and features
 */

import React, { useRef, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { Listing } from "./Listing";

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
          hasMore={count < MORE_TOTAL}
          isLoadingMore={isLoadingMore}
          isLoadMoreError={isLoadMoreError}
          loadMoreErrorMessage="More items couldn't be loaded. Try again."
          scrollRef={scrollRef}
          SkeletonTile={SkeletonTile}
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
            entityCount={isError ? 0 : visibleItems.length}
            isError={isError}
            isLoading={isLoading}
            skeletonCount={6}
            SkeletonTile={SkeletonTile}
          >
            {visibleItems.map((title) => (
              <ExampleTile key={title} title={title} />
            ))}
          </Listing>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Append Loader
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          With appendLoader, existing content stays visible while skeleton tiles appear below —
          useful for infinite scroll or "load more" patterns.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            appendLoader={true}
            className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4"
            entityCount={3}
            isLoading={true}
            skeletonCount={3}
            SkeletonTile={SkeletonTile}
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
            isLoading={true}
            skeletonCount={8}
            SkeletonTile={SkeletonTile}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Custom No Results
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Use the customNoResults prop to replace the default empty state with your own content.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            customNoResults={
              <div className="flex flex-col items-center gap-y-4 py-16">
                <Typography appearance="subdued" typographyType="body-md">
                  No mods installed yet
                </Typography>

                <Button brand="neutral" appearance="subdued">
                  Browse mods
                </Button>
              </div>
            }
            entityCount={0}
            SkeletonTile={SkeletonTile}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Loading More
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          For a list that loads a page at a time, such as an infinite query: with hasMore and
          onLoadMore, the Listing asks for more as the end of the items comes within 320px of its
          scroller&apos;s view. isLoadingMore draws tiles after the items while more load, and
          isLoadMoreError offers onRetry after them, keeping the items already shown.
        </Typography>

        <LoadMoreExample />
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Custom Error
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Use the errorTitle and errorMessage props to display API errors or other failure messages.
          The default error icon and "Contact support" link are shown automatically when isError is
          true.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            entityCount={0}
            errorMessage="GET /v2/collections returned 503: The server is temporarily unavailable. Please try again later."
            errorTitle="Failed to load collections"
            isError={true}
            SkeletonTile={SkeletonTile}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Design Notes
        </Typography>

        <Typography appearance="subdued" as="ul" className="list-inside list-disc space-y-2">
          <li>Listing renders one of three states: loading/content, error, or no results</li>

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
