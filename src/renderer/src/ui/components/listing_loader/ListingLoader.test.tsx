import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { ListingLoader } from "./ListingLoader";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const SkeletonTile = () => <div data-testid="skeleton" />;

// --- Tests ---

describe("ListingLoader", () => {
  it("renders skeletonCount skeletons while loading", () => {
    render(<ListingLoader SkeletonTile={SkeletonTile} isLoading={true} skeletonCount={3} />);
    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
  });

  it("does not render children while loading unless append is set", () => {
    render(
      <ListingLoader SkeletonTile={SkeletonTile} isLoading={true} skeletonCount={2}>
        <div data-testid="content" />
      </ListingLoader>,
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("renders children alongside skeletons when append is set", () => {
    render(
      <ListingLoader SkeletonTile={SkeletonTile} append={true} isLoading={true} skeletonCount={2}>
        <div data-testid="content" />
      </ListingLoader>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
  });

  it("renders only children (no skeletons) when not loading", () => {
    render(
      <ListingLoader SkeletonTile={SkeletonTile} isLoading={false} skeletonCount={2}>
        <div data-testid="content" />
      </ListingLoader>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <ListingLoader
        SkeletonTile={SkeletonTile}
        className="my-class"
        isLoading={false}
        skeletonCount={1}
      />,
    );
    expect(container.firstChild).toHaveClass("my-class");
  });
});
