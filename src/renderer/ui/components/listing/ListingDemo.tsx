/**
 * Listing Demo Component
 * Demonstrates the Listing component states and features
 */

import React, { useState } from "react";

import { Button } from "../button";
import { Typography } from "../typography";
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
          Container that manages loading, error, and empty states for lists of
          content. Provide a SkeletonTile component and the Listing handles
          state transitions automatically.
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
            buttonType="secondary"
            {...(isLoading ? { filled: "strong" } : {})}
            size="sm"
            onClick={() => {
              setIsLoading(!isLoading);
              setIsError(false);
            }}
          >
            {isLoading ? "Loading: On" : "Loading: Off"}
          </Button>

          <Button
            buttonType="secondary"
            {...(isError ? { filled: "strong" } : {})}
            size="sm"
            onClick={() => {
              setIsError(!isError);
              setIsLoading(false);
            }}
          >
            {isError ? "Error: On" : "Error: Off"}
          </Button>

          <Button
            buttonType="secondary"
            {...(isEmpty ? { filled: "strong" } : {})}
            size="sm"
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
          With appendLoader, existing content stays visible while skeleton tiles
          appear below — useful for infinite scroll or "load more" patterns.
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
          The skeletonCount prop controls how many placeholder tiles appear
          during loading. Default is 4.
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
          Use the customNoResults prop to replace the default empty state with
          your own content.
        </Typography>

        <div className="rounded-sm border border-stroke-weak p-4">
          <Listing
            customNoResults={
              <div className="flex flex-col items-center gap-y-4 py-16">
                <Typography appearance="subdued" typographyType="body-md">
                  No mods installed yet
                </Typography>

                <Button buttonType="secondary" size="sm">
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
          Custom Error
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Use the errorTitle and errorMessage props to display API errors or
          other failure messages. The default error icon and "Contact support"
          link are shown automatically when isError is true.
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

        <Typography
          appearance="subdued"
          as="ul"
          className="list-inside list-disc space-y-2"
        >
          <li>
            Listing renders one of three states: loading/content, error, or no
            results
          </li>

          <li>
            SkeletonTile is a required prop — provide a component that matches
            the shape of your content tiles
          </li>

          <li>
            The className prop is passed to the grid container, so layout
            classes like CSS grid work directly
          </li>

          <li>
            Use additionalContent for elements like pagination that should
            appear after the list when not loading
          </li>

          <li>
            Use customError or customNoResults to fully override the default
            empty states
          </li>
        </Typography>
      </div>
    </div>
  );
};
