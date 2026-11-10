import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModList } from "./ModList";

// The user's settings, which the cards read, aren't needed here.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({
  userInfo: () => undefined,
  canSeeAdultContent: () => true,
  isLoggedIn: () => true,
}));
vi.mock("../../../hooks/use_mod_status/useModStatus.hook", () => ({
  useModStatus: () => ({ installState: { kind: "none" }, status: undefined }),
}));

type IModListProps = React.ComponentProps<typeof ModList>;
type IMod = IModListProps["mods"][number];

const mod = (id: string) =>
  ({
    id,
    name: `Mod ${id}`,
    summary: "",
    author: { name: "schlangster" },
    game: { domain_name: "skyrimspecialedition" },
    thumbnail_url: null,
    downloads: 0,
    endorsements: 0,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z",
    adult: false,
  }) as unknown as IMod;

/** So many mods, with ids from 1. */
const modsUpTo = (count: number) => Array.from({ length: count }, (_, i) => mod(`${i + 1}`));

const defaults = (): IModListProps => ({
  activeModId: undefined,
  onFocusDetails: vi.fn(),
  isError: false,
  isLoading: false,
  hasMore: false,
  isLoadingMore: false,
  isLoadMoreError: false,
  mods: [],
  searchKey: "trending",
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onSelectMod: vi.fn(),
});

const renderComponent = (props: Partial<IModListProps> = {}) => {
  const all = { ...defaults(), ...props };
  const view = render(<ModList {...all} />);

  return {
    ...all,
    rerender: (next: Partial<IModListProps>) => view.rerender(<ModList {...all} {...next} />),
  };
};

/** The list, opening the mod it's told to pick, as Browse does. */
const PickingList = (props: Partial<IModListProps>) => {
  const [activeModId, setActiveModId] = useState<string>();

  return (
    <ModList {...defaults()} {...props} activeModId={activeModId} onSelectMod={setActiveModId} />
  );
};

/** The cards rendered, by their mods' names. */
const renderedCards = () =>
  screen.queryAllByRole("button", { name: /^Mod \d+/ }).map((card) => card.textContent);

const list = () => screen.getByRole("region", { name: "Mods" });

describe("ModList", () => {
  // jsdom has no layout: give the list's scroller a height, and each card one in it.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "region") {
          return 400;
        }

        return this.dataset.index === undefined ? 0 : 160;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers to try a failed first page again", async () => {
    const { onRetry } = renderComponent({ isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("offers to try a failed later page again under the mods it has", async () => {
    const { onRetry } = renderComponent({ mods: modsUpTo(2), isLoadMoreError: true });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalled();
    expect(renderedCards()).toHaveLength(2);
  });

  it("leaves focus on the list after Try again, as the button goes", async () => {
    const { onRetry } = renderComponent({ mods: modsUpTo(2), isLoadMoreError: true });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalled();
    expect(list()).toHaveFocus();
  });

  it("renders only the cards near those in view", () => {
    renderComponent({ mods: modsUpTo(50) });

    expect(renderedCards().length).toBeGreaterThan(0);
    expect(renderedCards().length).toBeLessThan(10);
  });

  it("keeps the open mod rendered far out of view, as the list's Tab stop", () => {
    renderComponent({ mods: modsUpTo(50), activeModId: "45" });

    expect(screen.getByRole("button", { name: /^Mod 45/ })).toHaveAttribute("tabindex", "0");
  });

  it.each([
    [true, 1],
    [false, 0],
  ])("asks for more as the end nears the view, when there's more: %s", (hasMore, calls) => {
    const reports: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          reports.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const { onLoadMore } = renderComponent({ mods: modsUpTo(50), hasMore });

    act(() => reports.forEach((report) => report([{ isIntersecting: true }])));

    expect(onLoadMore).toHaveBeenCalledTimes(calls);
    vi.unstubAllGlobals();
  });

  it("scrolls back to the top for another search", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    const scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = scrollTo;

    try {
      const { rerender } = renderComponent({ mods: modsUpTo(50) });
      rerender({ mods: modsUpTo(50) });
      scrollTo.mockClear();

      rerender({ searchKey: "popular" });

      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    } finally {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", original);
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
      }
    }
  });

  it("asks to move focus to the details pane on Right from a card", async () => {
    const { onFocusDetails } = renderComponent({ activeModId: "1", mods: [mod("1")] });

    act(() => screen.getByRole("button", { name: /Mod 1/ }).focus());
    await userEvent.keyboard("{ArrowRight}");

    expect(onFocusDetails).toHaveBeenCalled();
  });

  it.each([
    ["{ArrowDown}", "1"],
    ["{Home}", "1"],
    ["{ArrowUp}", "3"],
    ["{End}", "3"],
  ])("picks a mod from the list itself with %s", async (key, id) => {
    const { onSelectMod } = renderComponent({ mods: modsUpTo(3) });
    act(() => list().focus());

    await userEvent.keyboard(key);

    expect(onSelectMod).toHaveBeenCalledWith(id, "keyboard");
    expect(screen.getByRole("button", { name: new RegExp(`Mod ${id}`) })).toHaveFocus();
  });

  it.each([
    ["{ArrowDown}", "2"],
    ["{ArrowUp}", "1"],
  ])("moves to the next mod with %s from a card", async (key, id) => {
    render(<PickingList mods={modsUpTo(3)} />);
    act(() => list().focus());
    await userEvent.keyboard("{ArrowDown}");

    await userEvent.keyboard(key);

    expect(screen.getByRole("button", { name: new RegExp(`^Mod ${id}`) })).toHaveFocus();
  });

  it("goes to the last mod loaded with End, however far out of view", async () => {
    render(<PickingList mods={modsUpTo(50)} />);
    act(() => list().focus());
    await userEvent.keyboard("{Home}");

    await userEvent.keyboard("{End}");

    expect(screen.getByRole("button", { name: /^Mod 50/ })).toHaveFocus();
  });

  it("places the cards where the list scrolls to after another search's first page loads", () => {
    const resized: ((entries: []) => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: (entries: []) => void) {
          resized.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    let scrollTop = 0;
    vi.spyOn(HTMLElement.prototype, "scrollTop", "get").mockImplementation(() => scrollTop);
    // The cards start 24px into the scroller's content; one no longer in the page is at 0.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const isScroller = this.getAttribute("role") === "region";
        return { top: isScroller || !this.isConnected ? 0 : 24 - scrollTop } as DOMRect;
      },
    );
    const { rerender } = renderComponent({ mods: modsUpTo(50) });
    act(() => resized.forEach((report) => report([])));

    rerender({ mods: [], isLoading: true });
    rerender({ mods: modsUpTo(50), searchKey: "popular" });
    scrollTop = 160 * 30;
    act(() => {
      list().dispatchEvent(new Event("scroll"));
      resized.forEach((report) => report([]));
    });

    expect(screen.getByRole("button", { name: /^Mod 31/ })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("picks nothing from the keys while another search's first page loads", async () => {
    const { onSelectMod } = renderComponent({ mods: modsUpTo(3), isLoading: true });
    act(() => list().focus());

    await userEvent.keyboard("{ArrowDown}{End}");

    expect(onSelectMod).not.toHaveBeenCalled();
  });

  it("picks a mod clicked, saying it was the pointer", async () => {
    const { onSelectMod } = renderComponent({ mods: modsUpTo(2) });

    await userEvent.click(screen.getByRole("button", { name: /Mod 2/ }));

    expect(onSelectMod).toHaveBeenCalledWith("2", "pointer");
  });
});
