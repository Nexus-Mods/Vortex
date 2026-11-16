import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { Listing } from "./Listing";
import type { ListingStatus } from "./listing_status/listingStatus";

// --- Helpers ---

const SkeletonTile = () => <div data-testid="skeleton" />;

const renderComponent = (props: Partial<React.ComponentProps<typeof Listing>> = {}) => {
  render(<Listing SkeletonTile={SkeletonTile} {...props} />);
};

// --- Tests ---

describe("Listing", () => {
  describe("loading", () => {
    it("renders skeletons while loading", () => {
      renderComponent({ status: "loading", skeletonCount: 3 });
      expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    });
  });

  describe("with content", () => {
    it("draws tiles in place of the items while they load again", () => {
      renderComponent({
        children: <div data-testid="content" />,
        entityCount: 2,
        status: "loading",
      });
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(4);
    });

    it("shows the error in place of the items once it's failed", () => {
      renderComponent({
        children: <div data-testid="content" />,
        entityCount: 2,
        errorTitle: "Boom",
        status: "failed",
      });
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
      expect(screen.getByText("Boom")).toBeInTheDocument();
    });

    it("renders children when there are entities and it's done", () => {
      renderComponent({ children: <div data-testid="content" />, entityCount: 2 });
      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    });
  });

  describe("error", () => {
    it("renders the error NoResults with the given title", () => {
      renderComponent({ errorTitle: "Boom", status: "failed" });
      expect(screen.getByText("Boom")).toBeInTheDocument();
    });

    it("offers to try again, beside contacting support, when it's given a retry", async () => {
      const onRetry = vi.fn();
      renderComponent({ status: "failed", onRetry });

      await userEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
    });

    it("renders customError when provided", () => {
      renderComponent({ customError: <div data-testid="custom-error" />, status: "failed" });
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
      renderComponent({ children: items, entityCount: 2, status: "loading_more" });

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
    });

    it("offers to try again after the items when more failed to load, keeping them", async () => {
      const onRetry = vi.fn();
      renderComponent({
        children: items,
        entityCount: 2,
        errorTitle: "Something went wrong",
        loadMoreErrorMessage: "More mods couldn't be loaded.",
        onRetry,
        status: "load_more_failed",
      });

      await userEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalled();
      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.getByText("More mods couldn't be loaded.")).toBeInTheDocument();
    });

    it("asks for more as the end of the items nears the view of the scroller it's given", () => {
      const onLoadMore = vi.fn();
      const scrollRef = { current: null as HTMLDivElement | null };
      render(
        <div data-testid="scroller" ref={scrollRef}>
          <Listing
            entityCount={2}
            scrollRef={scrollRef}
            SkeletonTile={SkeletonTile}
            status="idle"
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
      expect(onLoadMore).toHaveBeenCalledExactlyOnceWith("scroll");
    });

    it("watches the window's view when it's given no scroller", () => {
      renderComponent({ children: items, entityCount: 2, status: "idle", onLoadMore: vi.fn() });

      expect(observed[0].options?.root).toBeNull();
    });

    it.each<[string, ListingStatus]>([
      ["there's no more", "done"],
      ["more is loading", "loading_more"],
      ["loading more failed", "load_more_failed"],
      ["the first items are loading", "loading"],
      ["it's paused", "paused"],
    ])("asks for no more while %s", (_, status) => {
      renderComponent({ children: items, entityCount: 2, onLoadMore: vi.fn(), status });

      expect(observed).toHaveLength(0);
    });

    it("watches again once more has loaded, in case the end is still in view", () => {
      const props = {
        children: items,
        entityCount: 2,
        status: "idle" as const,
        onLoadMore: vi.fn(),
      };
      const { rerender } = render(<Listing SkeletonTile={SkeletonTile} {...props} />);

      rerender(<Listing SkeletonTile={SkeletonTile} {...props} status="loading_more" />);
      rerender(<Listing SkeletonTile={SkeletonTile} {...props} entityCount={4} />);
      act(() => observed[1].report(true));

      expect(observed).toHaveLength(2);
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe("paused", () => {
    const items = <div data-testid="content" />;

    it("offers to load more after the items, with a summary over the button", async () => {
      const onLoadMore = vi.fn();
      renderComponent({
        children: items,
        entityCount: 2,
        loadMoreLabel: "Load more mods",
        loadMoreSummary: "Showing 60 of 2,438 mods",
        onLoadMore,
        status: "paused",
      });

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.getByTestId("listing-load-more-summary")).toBeInTheDocument();

      await userEvent.click(screen.getByTestId("listing-load-more"));

      expect(onLoadMore).toHaveBeenCalledExactlyOnceWith("button");
    });

    it("gives out the Load more button, for the list's keys", () => {
      const loadMoreRef = { current: null as HTMLButtonElement | null };
      renderComponent({
        children: items,
        entityCount: 2,
        loadMoreRef,
        onLoadMore: vi.fn(),
        status: "paused",
      });

      expect(loadMoreRef.current).toBe(screen.getByTestId("listing-load-more"));
    });

    it("shows a note over the summary when given one", () => {
      renderComponent({
        children: items,
        entityCount: 2,
        loadMoreNote: "600 mods later",
        onLoadMore: vi.fn(),
        status: "paused",
      });

      expect(screen.getByTestId("listing-load-more-note")).toBeInTheDocument();
    });

    it("shows no note without one", () => {
      renderComponent({ children: items, entityCount: 2, onLoadMore: vi.fn(), status: "paused" });

      expect(screen.queryByTestId("listing-load-more-note")).toBeNull();
    });

    it("shows no line over the button without a summary", () => {
      renderComponent({ children: items, entityCount: 2, onLoadMore: vi.fn(), status: "paused" });

      expect(screen.queryByTestId("listing-load-more-summary")).toBeNull();
    });

    it("shows what's given under the Load more button", () => {
      renderComponent({
        entityCount: 1,
        loadMoreFooter: <div data-testid="footer" />,
        onLoadMore: vi.fn(),
        status: "paused",
      });

      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("shows nothing under the Load more button while it isn't paused", () => {
      renderComponent({
        entityCount: 1,
        loadMoreFooter: <div data-testid="footer" />,
        onLoadMore: vi.fn(),
        status: "idle",
      });

      expect(screen.queryByTestId("footer")).toBeNull();
    });

    it("offers nothing to load more with nowhere to ask for it", () => {
      renderComponent({ children: items, entityCount: 2, status: "paused" });

      expect(screen.queryByTestId("listing-load-more")).toBeNull();
    });
  });
});
