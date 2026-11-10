import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { Listing } from "./Listing";

// --- Helpers ---

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
  });

  describe("with content", () => {
    it("renders children when there are entities and not loading", () => {
      renderComponent({ children: <div data-testid="content" />, entityCount: 2 });
      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    });
  });

  describe("error", () => {
    it("renders the error NoResults with the given title", () => {
      renderComponent({ errorTitle: "Boom", isError: true });
      expect(screen.getByText("Boom")).toBeInTheDocument();
    });

    it("offers to try again, beside contacting support, when it's given a retry", async () => {
      const onRetry = vi.fn();
      renderComponent({ isError: true, onRetry });

      await userEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
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

  describe("loading more", () => {
    interface IObserved {
      report: (isIntersecting: boolean) => void;
      options: IntersectionObserverInit | undefined;
    }

    let observed: IObserved[];

    // jsdom has no IntersectionObserver: record each one, to report its marker as in view or not.
    beforeEach(() => {
      observed = [];
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(
            callback: (entries: { isIntersecting: boolean }[]) => void,
            options?: IntersectionObserverInit,
          ) {
            observed.push({ report: (isIntersecting) => callback([{ isIntersecting }]), options });
          }
          observe() {}
          disconnect() {}
        },
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const items = <div data-testid="content" />;

    it("draws tiles after the items while more load, keeping the items", () => {
      renderComponent({ children: items, entityCount: 2, isLoadingMore: true });

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
    });

    it("offers to try again after the items when more failed to load, keeping them", async () => {
      const onRetry = vi.fn();
      renderComponent({
        children: items,
        entityCount: 2,
        errorTitle: "Something went wrong",
        isLoadMoreError: true,
        loadMoreErrorMessage: "More mods couldn't be loaded.",
        onRetry,
      });

      await userEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalled();
      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.getByText("More mods couldn't be loaded.")).toBeInTheDocument();
    });

    it("draws only the tiles while more load again after failing", () => {
      renderComponent({
        children: items,
        entityCount: 2,
        isLoadingMore: true,
        isLoadMoreError: true,
        loadMoreErrorMessage: "More mods couldn't be loaded.",
      });

      expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
      expect(screen.queryByText("More mods couldn't be loaded.")).toBeNull();
    });

    it("asks for more as the end of the items nears the view of the scroller it's given", () => {
      const onLoadMore = vi.fn();
      const scrollRef = { current: null as HTMLDivElement | null };
      render(
        <div data-testid="scroller" ref={scrollRef}>
          <Listing
            hasMore
            entityCount={2}
            scrollRef={scrollRef}
            SkeletonTile={SkeletonTile}
            onLoadMore={onLoadMore}
          >
            {items}
          </Listing>
        </div>,
      );
      expect(observed).toHaveLength(1);
      expect(observed[0].options?.root).toBe(screen.getByTestId("scroller"));
      expect(observed[0].options?.rootMargin).toBe("0px 0px 320px 0px");

      act(() => observed[0].report(false));
      expect(onLoadMore).not.toHaveBeenCalled();

      act(() => observed[0].report(true));
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it("watches the window's view when it's given no scroller", () => {
      renderComponent({ children: items, entityCount: 2, hasMore: true, onLoadMore: vi.fn() });

      expect(observed[0].options?.root).toBeNull();
    });

    it.each([
      ["there's no more", { hasMore: false }],
      ["more is loading", { hasMore: true, isLoadingMore: true }],
      ["loading more failed", { hasMore: true, isLoadMoreError: true }],
      ["the first items are loading", { hasMore: true, isLoading: true }],
    ])("asks for no more while %s", (_, state) => {
      renderComponent({ children: items, entityCount: 2, onLoadMore: vi.fn(), ...state });

      expect(observed).toHaveLength(0);
    });

    it("watches again once more has loaded, in case the end is still in view", () => {
      const props = { children: items, entityCount: 2, hasMore: true, onLoadMore: vi.fn() };
      const { rerender } = render(<Listing SkeletonTile={SkeletonTile} {...props} />);

      rerender(<Listing SkeletonTile={SkeletonTile} {...props} isLoadingMore />);
      rerender(<Listing SkeletonTile={SkeletonTile} {...props} entityCount={4} />);
      act(() => observed[1].report(true));

      expect(observed).toHaveLength(2);
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    });
  });
});
