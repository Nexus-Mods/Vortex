import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { ListingLoader } from "./ListingLoader";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const SkeletonTile = () => <div data-testid="skeleton" />;

const renderComponent = (props: Partial<React.ComponentProps<typeof ListingLoader>> = {}) => {
  render(<ListingLoader SkeletonTile={SkeletonTile} skeletonCount={2} {...props} />);
};

// --- Tests ---

describe("ListingLoader", () => {
  it("renders skeletonCount skeletons while loading", () => {
    renderComponent({ isLoading: true, skeletonCount: 3 });
    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
  });

  it("does not render children while loading unless append is set", () => {
    renderComponent({ children: <div data-testid="content" />, isLoading: true });
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("renders children alongside skeletons when append is set", () => {
    renderComponent({ append: true, children: <div data-testid="content" />, isLoading: true });
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
  });

  it("renders only children (no skeletons) when not loading", () => {
    renderComponent({ children: <div data-testid="content" />, isLoading: false });
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    renderComponent({ className: "my-class", isLoading: false, skeletonCount: 1 });
    expect(document.querySelector(".my-class")).toBeInTheDocument();
  });
});
