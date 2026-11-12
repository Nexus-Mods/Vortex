import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameDomain } from "@vortex/shared";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Mod } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { ListingStatus } from "@/ui/components/listing/listing_status/listingStatus";
import { queryClient } from "@/util/queryClient";

import type { IModSearch } from "../../hooks/use_mod_search/useModSearch.hook";
import { NO_FILTERS } from "../../util/mod_views/modViews";
import { websiteModSearchUrl } from "../../util/website_mod_search_url/websiteModSearchUrl";

// The list, bar, backdrop and details are stood in for: these test which mod the details show.
const openFeedback = vi.hoisted(() => vi.fn());
vi.mock("./browse_mods_bar/BrowseModsBar", () => ({
  BrowseModsBar: ({ feedback }: { feedback: { onOpen: () => void } }) => (
    <button data-testid="browse-mods-feedback" onClick={feedback.onOpen} />
  ),
}));
vi.mock("../../hooks/use_mod_browsing_feedback/useModBrowsingFeedback.hook", () => ({
  useModBrowsingFeedback: () => ({
    hasGiven: false,
    open: openFeedback,
    modal: <p data-testid="feedback-modal" />,
  }),
}));
vi.mock("./mod_backdrop/ModBackdrop", () => ({
  ModBackdrop: ({ src, blurredSrc }: { src?: string; blurredSrc?: string }) => (
    <p data-testid="backdrop">{`${src} ${blurredSrc}`}</p>
  ),
}));
vi.mock("@/ui/components/resizable_split/useSavedSplit.hook", () => ({
  useSavedSplit: () => [0.5, vi.fn()],
}));
const mounts = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({ mods: {} as Record<string, unknown> }));

vi.mock("@/extensions/nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({
    getModById: (id: string) =>
      id in mocks.mods ? Promise.resolve(mocks.mods[id]) : new Promise(() => undefined),
  }),
}));

vi.mock("./mod_details/ModDetails", () => ({
  ModDetails: React.forwardRef<
    HTMLDivElement,
    { mod: ModSummary; gallery: Array<{ large_thumbnail_url: string }>; onFocusList: () => void }
  >(({ mod, gallery, onFocusList }, ref) => {
    React.useEffect(() => {
      mounts.push(mod.id);
    }, []);

    return (
      <div aria-label={`Details of ${mod.name}`} ref={ref} role="region" tabIndex={-1}>
        <p data-testid="details">{mod.name}</p>
        {gallery.map(({ large_thumbnail_url }) => (
          <p data-testid="gallery-image" key={large_thumbnail_url}>
            {large_thumbnail_url}
          </p>
        ))}
        <button onClick={onFocusList}>Back to the list</button>
      </div>
    );
  }),
}));
vi.mock("./mod_details/ModDetails.skeleton", () => ({
  ModDetailsSkeleton: () => <p data-testid="details-skeleton" />,
}));
vi.mock("./mod_list/ModList", () => ({
  ModList: ({
    mods,
    activeModId,
    listRef,
    status,
    onFocusDetails,
    onPassLastMod,
    onLoadMore,
    onRetry,
    onSelectMod,
    emptyState,
    endOfResults,
    loadMoreFooter,
  }: {
    mods: ModSummary[];
    activeModId: string;
    listRef: React.Ref<{ focus: () => void; focusOpenMod: () => void }>;
    status: ListingStatus;
    onLoadMore: (source: "scroll" | "button") => void;
    onFocusDetails: () => void;
    onPassLastMod: () => void;
    onRetry: () => void;
    onSelectMod: (id: string, input: string) => void;
    emptyState: React.ReactNode;
    endOfResults: React.ReactNode;
    loadMoreFooter: React.ReactNode;
  }) => {
    const regionRef = React.useRef<HTMLDivElement>(null);
    const openModRef = React.useRef<HTMLButtonElement>(null);

    React.useImperativeHandle(listRef, () => ({
      focus: () => regionRef.current?.focus(),
      focusOpenMod: () => openModRef.current?.focus(),
    }));

    return (
      <div aria-label="Mods" ref={regionRef} role="region" tabIndex={-1}>
        {!mods.length && emptyState}
        {!!mods.length && <div data-testid="end-of-results">{endOfResults}</div>}
        <button data-testid="pass-last-mod" onClick={onPassLastMod}>
          Pass the last mod
        </button>
        {status === "paused" && (
          <button data-testid="load-more" onClick={() => onLoadMore("button")}>
            Load more
          </button>
        )}
        {status === "paused" && loadMoreFooter}
        {(status === "failed" || status === "load_more_failed") && (
          <button onClick={onRetry}>Retry</button>
        )}
        {mods.map((mod) => (
          <button
            data-testid={`mock-card-${mod.id}`}
            key={mod.id}
            ref={mod.id === activeModId ? openModRef : undefined}
            tabIndex={mod.id === activeModId ? 0 : -1}
            onClick={() => onSelectMod(mod.id, "pointer")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSelectMod(mod.id, "keyboard");
              }
              if (event.key === "ArrowRight") {
                onFocusDetails();
              }
            }}
          >
            {mod.name}
          </button>
        ))}
      </div>
    );
  },
}));

// The active game, by its name and Nexus Mods domain.
vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: () => ({ name: "Skyrim Special Edition" }),
}));
vi.mock("../../hooks/use_game_domain_name/useGameDomainName.hook", () => ({
  useGameDomainName: () => "skyrimspecialedition",
}));

import { BrowseMods } from "./BrowseMods";

/** One of a mod's images in each size, as the API sends it. */
const image = (name: string) => ({
  id: name,
  title: "",
  url: `${name}.png`,
  thumbnail_url: `${name}-thumb.png`,
  large_thumbnail_url: `${name}-large.png`,
  blurred_thumbnail_url: `${name}-blurred.png`,
  blurred_large_thumbnail_url: `${name}-blurred-large.png`,
});

const mod = (id: string, thumbnail_url: string | null = null) =>
  ({ id, name: `Mod ${id}`, thumbnail_url }) as ModSummary;

/** The open view's sort and filters, the same objects from render to render, as the view's are. */
const SORT = { field: "endorsements", direction: "desc" } as const;
const FILTERS = { ...NO_FILTERS, timeRange: "7" } as const;

const search = (mods: ModSummary[], loading = false, overrides: Partial<IModSearch> = {}) =>
  ({
    mods,
    status: loading ? "loading" : "done",
    retry: vi.fn(),
    viewId: "trending",
    trackedView: "trending",
    views: [],
    isEdited: false,
    sort: SORT,
    filters: FILTERS,
    pagesLoaded: 0,
    ...overrides,
  }) as unknown as IModSearch;

/** What the search's events say it was. */
const searched = {
  view: "trending",
  sort_field: "endorsements",
  sort_direction: "desc",
  has_search: false,
  time_range: "7",
  adult: "include",
};

const renderComponent = (initial: IModSearch, isInitiallyShown = true) => {
  const api = {} as IExtensionApi;
  const tracking = browseModsTracking();
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  const wrap = (search: IModSearch, isShown: boolean) => (
    <QueryClientProvider client={client}>
      <BrowseMods api={api} isShown={isShown} search={search} />
    </QueryClientProvider>
  );
  const { rerender } = render(wrap(initial, isInitiallyShown), { wrapper: tracking.wrapper });
  return {
    rerender: (next: IModSearch, isShown = true) => rerender(wrap(next, isShown)),
    propertiesOf: (eventName: string) =>
      tracking.tracked(eventName).map(({ properties }) => properties),
  };
};

describe("BrowseMods", () => {
  it("renders the feedback modal", () => {
    renderComponent(search([mod("1")]));

    expect(screen.getByTestId("feedback-modal")).toBeInTheDocument();
  });

  it("opens the feedback from the toolbar", async () => {
    openFeedback.mockClear();
    renderComponent(search([mod("1")]));

    await userEvent.click(screen.getByTestId("browse-mods-feedback"));

    expect(openFeedback).toHaveBeenCalledWith("toolbar");
  });

  it("opens the feedback from a thumb under Load more with its sentiment", async () => {
    openFeedback.mockClear();
    renderComponent(search([mod("1")], false, { status: "paused", loadMore: vi.fn() }));

    await userEvent.click(screen.getByTestId("load-more-feedback-negative"));

    expect(openFeedback).toHaveBeenCalledWith("load_more", "negative");
  });

  it("shows the first mod until another's picked", async () => {
    renderComponent(search([mod("1"), mod("2")]));
    expect(screen.getByTestId("details")).toHaveTextContent("Mod 1");

    await userEvent.click(screen.getByRole("button", { name: "Mod 2" }));
    expect(screen.getByTestId("details")).toHaveTextContent("Mod 2");
  });

  it("opens another mod's details afresh, from the top", async () => {
    mounts.length = 0;
    renderComponent(search([mod("1"), mod("2")]));

    await userEvent.click(screen.getByRole("button", { name: "Mod 2" }));

    expect(mounts).toEqual(["1", "2"]);
  });

  it("keeps the picked mod through another search", async () => {
    const { rerender } = renderComponent(search([mod("1"), mod("2")]));
    await userEvent.click(screen.getByRole("button", { name: "Mod 2" }));

    rerender(search([mod("1"), mod("2")], true));
    rerender(search([mod("3"), mod("4")]));

    expect(screen.getByTestId("details")).toHaveTextContent("Mod 2");
    expect(screen.queryByTestId("details-skeleton")).not.toBeInTheDocument();
  });

  it("keeps the first mod through another search when none's been picked", () => {
    const { rerender } = renderComponent(search([mod("1"), mod("2")]));

    rerender(search([mod("3"), mod("4")]));

    expect(screen.getByTestId("details")).toHaveTextContent("Mod 1");
  });

  it("pulses while the first mods load, and says there's none when there aren't any", () => {
    const { rerender } = renderComponent(search([], true));
    expect(screen.getByTestId("details-skeleton")).toBeInTheDocument();

    rerender(search([]));
    expect(screen.getByText("No mod to show")).toBeInTheDocument();
  });

  it("shows the search's thumbnail in the details' gallery until the mod's own images arrive", async () => {
    mocks.mods = {
      "1": {
        primary_image: null,
        gallery_images: [image("a"), image("b")],
      } as unknown as Mod,
    };
    renderComponent(search([mod("1", "thumb.png")]));

    expect(screen.getAllByTestId("gallery-image").map((image) => image.textContent)).toEqual([
      "thumb.png",
    ]);
    expect(await screen.findByText("b-large.png")).toBeInTheDocument();
    expect(screen.getAllByTestId("gallery-image").map((image) => image.textContent)).toEqual([
      "a-large.png",
      "b-large.png",
    ]);
  });

  it("puts the picked picture behind, with its blurred version for adult content", async () => {
    mocks.mods = {
      "1": { primary_image: null, gallery_images: [image("a")] } as unknown as Mod,
    };
    renderComponent(search([mod("1", "thumb.png")]));

    expect(await screen.findByText("a-large.png")).toBeInTheDocument();
    expect(screen.getByTestId("backdrop")).toHaveTextContent("a-large.png a-blurred-large.png");
  });

  it("moves focus to the open mod in the list when the details ask", async () => {
    renderComponent(search([mod("1"), mod("2")]));
    await userEvent.click(screen.getByRole("button", { name: "Mod 2" }));

    await userEvent.click(screen.getByRole("button", { name: "Back to the list" }));

    expect(screen.getByRole("button", { name: "Mod 2" })).toHaveFocus();
  });

  it("counts picking a mod, with its place across the pages loaded", async () => {
    const loaded = Array.from({ length: 22 }, (_, i) => mod(`${i + 1}`));
    const { propertiesOf } = renderComponent(search(loaded, false, { pagesLoaded: 2 }));

    await userEvent.click(screen.getByRole("button", { name: "Mod 22" }));
    await userEvent.click(screen.getByRole("button", { name: "Mod 22" }));

    expect(propertiesOf("browse_mods_mod_selected")).toEqual([
      { mod_uid: "22", view: "trending", position: 22, input: "pointer" },
    ]);
  });

  it("shows and counts a mod clicked at once", () => {
    mounts.length = 0;
    const { propertiesOf } = renderComponent(search([mod("1"), mod("2")]));

    fireEvent.click(screen.getByRole("button", { name: "Mod 2" }));

    expect(screen.getByTestId("details")).toHaveTextContent("Mod 2");
    expect(propertiesOf("browse_mods_mod_selected")).toEqual([
      { mod_uid: "2", view: "trending", position: 2, input: "pointer" },
    ]);
  });

  it("shows and counts only the mod that moving through the list from the keyboard stops on", () => {
    vi.useFakeTimers();
    mounts.length = 0;
    const { propertiesOf } = renderComponent(search([mod("1"), mod("2"), mod("3"), mod("4")]));
    const press = (name: string) =>
      fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });

    try {
      press("Mod 2");
      press("Mod 3");
      press("Mod 4");
      fireEvent.keyUp(window, { key: "Enter" });
      act(() => {
        vi.advanceTimersByTime(149);
      });
      expect(screen.getByTestId("details")).toHaveTextContent("Mod 1");

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByTestId("details")).toHaveTextContent("Mod 4");
      expect(mounts).toEqual(["1", "4"]);
      expect(propertiesOf("browse_mods_mod_selected")).toEqual([
        { mod_uid: "4", view: "trending", position: 4, input: "keyboard" },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows and counts no mod picked on the way past the last one", () => {
    vi.useFakeTimers();
    const { propertiesOf } = renderComponent(search([mod("1"), mod("2")]));

    try {
      fireEvent.keyDown(screen.getByTestId("mock-card-2"), { key: "Enter" });
      fireEvent.click(screen.getByTestId("pass-last-mod"));
      fireEvent.keyUp(window, { key: "Enter" });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByTestId("details")).toHaveTextContent("Mod 1");
      expect(screen.getByTestId("mock-card-1")).toHaveAttribute("tabindex", "0");
      expect(propertiesOf("browse_mods_mod_selected")).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a mod waiting from the keyboard at once when it's clicked", () => {
    vi.useFakeTimers();
    renderComponent(search([mod("1"), mod("2")]));

    try {
      fireEvent.keyDown(screen.getByRole("button", { name: "Mod 2" }), { key: "Enter" });
      fireEvent.keyUp(window, { key: "Enter" });
      expect(screen.getByTestId("details")).toHaveTextContent("Mod 1");

      fireEvent.click(screen.getByRole("button", { name: "Mod 2" }));

      expect(screen.getByTestId("details")).toHaveTextContent("Mod 2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens and focuses the details of a mod waiting from the keyboard on Right", () => {
    vi.useFakeTimers();
    renderComponent(search([mod("1"), mod("2")]));

    try {
      const card = screen.getByRole("button", { name: "Mod 2" });
      fireEvent.keyDown(card, { key: "Enter" });
      fireEvent.keyDown(card, { key: "ArrowRight" });

      expect(screen.getByRole("region", { name: "Details of Mod 2" })).toHaveFocus();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole("region", { name: "Details of Mod 2" })).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts a search that comes back empty once, not while it loads", () => {
    const { rerender, propertiesOf } = renderComponent(search([], true));
    expect(propertiesOf("browse_mods_no_results")).toEqual([]);

    rerender(search([]));
    rerender(search([]));

    expect(propertiesOf("browse_mods_no_results")).toEqual([searched]);
  });

  it("counts an empty search again for another view of the user's own searching alike", () => {
    const mine = { trackedView: "custom" } as const;
    const { rerender, propertiesOf } = renderComponent(
      search([], false, { ...mine, viewId: "custom-1" }),
    );

    rerender(search([], false, { ...mine, viewId: "custom-2", filters: { ...FILTERS } }));

    expect(propertiesOf("browse_mods_no_results")).toEqual([
      { ...searched, view: "custom" },
      { ...searched, view: "custom" },
    ]);
  });

  it("doesn't count the same empty search again when the view's objects are rebuilt", () => {
    const { rerender, propertiesOf } = renderComponent(search([]));

    rerender(search([], false, { sort: { ...SORT }, filters: { ...FILTERS } }));

    expect(propertiesOf("browse_mods_no_results")).toEqual([searched]);
  });

  it("counts retrying a search that failed", async () => {
    const failed = search([], false, { status: "failed" });
    const { propertiesOf } = renderComponent(failed);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(failed.retry).toHaveBeenCalled();
    expect(propertiesOf("browse_mods_retry_clicked")).toEqual([{ ...searched, pages_loaded: 0 }]);
    expect(propertiesOf("browse_mods_no_results")).toEqual([]);
  });

  it("counts retrying a later page that failed, with how many pages had loaded", async () => {
    const failed = search([mod("1"), mod("2")], false, {
      status: "load_more_failed",
      pagesLoaded: 2,
    });
    const { propertiesOf } = renderComponent(failed);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(failed.retry).toHaveBeenCalled();
    expect(propertiesOf("browse_mods_retry_clicked")).toEqual([{ ...searched, pages_loaded: 2 }]);
  });

  it("loads more from Load more, counting how many pages it had paused after", async () => {
    const paused = search([mod("1"), mod("2")], false, {
      status: "paused",
      pagesLoaded: 3,
      loadMore: vi.fn(),
    });
    const { propertiesOf } = renderComponent(paused);

    await userEvent.click(screen.getByTestId("load-more"));

    expect(paused.loadMore).toHaveBeenCalled();
    expect(propertiesOf("browse_mods_load_more_clicked")).toEqual([
      { ...searched, pages_loaded: 3 },
    ]);
  });

  it("counts an empty search only once the user can see it", () => {
    const { rerender, propertiesOf } = renderComponent(search([]), false);

    expect(propertiesOf("browse_mods_no_results")).toEqual([]);

    rerender(search([]), true);

    expect(propertiesOf("browse_mods_no_results")).toEqual([searched]);
  });

  describe("empty states", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** An empty search with these filters on, over the Trending preset's. */
    const emptyWith = (activeFilters: Array<"timeRange" | "adult">) =>
      search([], false, {
        activeFilters,
        activeFilterCount: activeFilters.length,
        setFilters: vi.fn(),
      });

    it("clears the filters on, and counts it from the empty state", async () => {
      const empty = emptyWith(["timeRange"]);
      const { propertiesOf } = renderComponent(empty);

      await userEvent.click(screen.getByRole("button", { name: "Remove 1 filter" }));

      expect(empty.setFilters).toHaveBeenCalledWith({ timeRange: "all" });
      expect(propertiesOf("browse_mods_time_range_changed")).toEqual([
        { view: "trending", time_range: "all", previous_time_range: "7", source: "empty_state" },
      ]);
      expect(propertiesOf("browse_mods_empty_state_filters_removed")).toEqual([
        { view: "trending", state: "filters_only", filter_count: 1 },
      ]);
    });

    it("keeps keyboard focus in the list after removing the filters", async () => {
      renderComponent(emptyWith(["timeRange"]));
      const remove = screen.getByRole("button", { name: "Remove 1 filter" });

      remove.focus();
      await userEvent.keyboard("{Enter}");

      expect(screen.getByRole("region", { name: "Mods" })).toHaveFocus();
    });

    it("opens the same search on Nexus Mods, and counts it", async () => {
      const openUrl = vi.fn();
      vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
      const { propertiesOf } = renderComponent(emptyWith(["timeRange"]));

      await userEvent.click(screen.getByRole("button", { name: "Search on website" }));

      expect(openUrl).toHaveBeenCalledWith(
        websiteModSearchUrl(GameDomain("skyrimspecialedition"), { sort: SORT, filters: FILTERS }),
      );
      expect(propertiesOf("browse_mods_empty_state_website_search_opened")).toEqual([
        { view: "trending", state: "filters_only" },
      ]);
    });

    it("offers no Remove filters with only a locked filter on", () => {
      renderComponent(emptyWith([]));

      expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    });

    it("clears a search nothing matches, keeping focus in the list, and counts it", async () => {
      const empty = { ...emptyWith([]), searchQuery: "sky", setSearchText: vi.fn() } as IModSearch;
      const { propertiesOf } = renderComponent(empty);
      const clear = screen.getByRole("button", { name: "Clear search" });

      clear.focus();
      await userEvent.keyboard("{Enter}");

      expect(empty.setSearchText).toHaveBeenCalledWith("");
      expect(screen.getByRole("region", { name: "Mods" })).toHaveFocus();
      expect(propertiesOf("browse_mods_search_cleared")).toEqual([
        { view: "trending", source: "empty_state" },
      ]);
    });

    it("counts a search of the mods' names that comes back empty as one", () => {
      const { propertiesOf } = renderComponent({
        ...emptyWith([]),
        searchQuery: "sky",
      } as IModSearch);

      expect(propertiesOf("browse_mods_no_results")).toEqual([{ ...searched, has_search: true }]);
    });

    it("counts each empty search of the mods' names, one after another", () => {
      const { rerender, propertiesOf } = renderComponent({
        ...emptyWith([]),
        searchQuery: "sky",
      } as IModSearch);

      rerender({ ...emptyWith([]), searchQuery: "skyui" } as IModSearch);

      expect(propertiesOf("browse_mods_no_results")).toHaveLength(2);
    });

    it("searches the website for the same text", async () => {
      const openUrl = vi.fn();
      vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
      renderComponent({ ...emptyWith([]), searchQuery: "sky" } as IModSearch);

      await userEvent.click(screen.getByRole("button", { name: "Search on website" }));

      expect(openUrl).toHaveBeenCalledWith(
        websiteModSearchUrl(GameDomain("skyrimspecialedition"), {
          text: "sky",
          sort: SORT,
          filters: FILTERS,
        }),
      );
    });

    it("ends the last page with the end of results", () => {
      renderComponent(search([mod("1")], false, { activeFilters: [], activeFilterCount: 0 }));

      expect(
        within(screen.getByTestId("end-of-results")).getByTestId("mod-list-hidden-mods-note"),
      ).toBeInTheDocument();
    });
  });
});
