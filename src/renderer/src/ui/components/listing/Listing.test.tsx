import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Listing } from "./Listing";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const SkeletonTile = () => <div data-testid="skeleton" />;

const renderComponent = (props: Partial<React.ComponentProps<typeof Listing>> = {}) => {
  render(<Listing SkeletonTile={SkeletonTile} {...props} />);
};

// --- Tests ---

describe("Listing", () => {
  describe("loading", () => {
    it("renders skeletons when isLoading", () => {
      renderComponent({ isLoading: true, skeletonCount: 3 });
      expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    });

    it("does not render additionalContent while still loading", () => {
      renderComponent({
        additionalContent: <div data-testid="more" />,
        isLoading: true,
        skeletonCount: 1,
      });
      expect(screen.queryByTestId("more")).not.toBeInTheDocument();
    });
  });

  describe("with content", () => {
    it("renders children when there are entities and not loading", () => {
      renderComponent({ children: <div data-testid="content" />, entityCount: 2 });
      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    });

    it("renders additionalContent once loaded", () => {
      renderComponent({
        additionalContent: <div data-testid="more" />,
        children: <div data-testid="content" />,
        entityCount: 2,
      });
      expect(screen.getByTestId("more")).toBeInTheDocument();
    });
  });

  describe("error", () => {
    it("renders the error NoResults with the given title", () => {
      renderComponent({ errorTitle: "Boom", isError: true });
      expect(screen.getByText("Boom")).toBeInTheDocument();
    });

    it("renders customError when provided", () => {
      renderComponent({ customError: <div data-testid="custom-error" />, isError: true });
      expect(screen.getByTestId("custom-error")).toBeInTheDocument();
    });
  });

  describe("empty", () => {
    it("renders the default no-results title when there are no entities", () => {
      renderComponent();
      expect(screen.getByText("No items found")).toBeInTheDocument();
    });

    it("renders a custom no-results title", () => {
      renderComponent({ noResultsTitle: "Nothing matched" });
      expect(screen.getByText("Nothing matched")).toBeInTheDocument();
    });

    it("renders customNoResults when provided", () => {
      renderComponent({ customNoResults: <div data-testid="custom-empty" /> });
      expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
    });
  });
});
