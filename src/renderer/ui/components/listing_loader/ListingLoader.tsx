import React, { type ComponentType, type PropsWithChildren } from "react";

export const ListingLoader = ({
  append,
  children,
  className,
  isLoading,
  skeletonCount,
  SkeletonTile,
}: PropsWithChildren<{
  SkeletonTile: ComponentType;
  append?: boolean;
  className?: string;
  isLoading?: boolean;
  skeletonCount: number;
}>) => (
  <div className={className}>
    {isLoading ? (
      <>
        {append && children}

        {Array.from({ length: skeletonCount }, (_, i) => `skeleton-${i}`).map(
          (key) => (
            <SkeletonTile key={key} />
          ),
        )}
      </>
    ) : (
      children
    )}
  </div>
);
