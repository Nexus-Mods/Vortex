import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Mod } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

const mocks = vi.hoisted(() => ({
  pending: [] as Array<{ resolve: (mod: unknown) => void; reject: (error: Error) => void }>,
}));

vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));
vi.mock("@/extensions/nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({
    getModById: () => new Promise((resolve, reject) => mocks.pending.push({ resolve, reject })),
  }),
}));

import { ModDetails } from "./ModDetails";

const summary = {
  id: "1704-1",
  game_scoped_id: "1",
  game: { domain_name: "skyrimspecialedition" },
  name: "SkyUI",
  summary: "Elegant, PC-friendly interface",
  author: { name: "schlangster" },
  category: { name: "User Interface" },
  thumbnail_url: null,
  endorsements: 1234,
  downloads: 9000,
  unique_downloads: 5600,
  file_size_kilobytes: 1024,
  created_at: "2020-01-01T00:00:00Z",
  updated_at: "2021-01-01T00:00:00Z",
  adult: false,
} as unknown as ModSummary;

const tags = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `${index}`, name: `Tag ${index + 1}` }));

const makeMod = (overrides: Partial<Mod> = {}) =>
  ({
    description: "A [b]better[/b] inventory",
    tags: tags(2),
    ...overrides,
  }) as Mod;

/** Answers the waiting mod query with the mod. */
const respond = (mod: Mod) => act(async () => mocks.pending.shift()!.resolve(mod));

/** Fails the waiting mod query. */
const fail = () => act(async () => mocks.pending.shift()!.reject(new Error("offline")));

const renderComponent = (mod = summary, onFocusList = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  render(
    <QueryClientProvider client={client}>
      <ModDetails
        api={{} as IExtensionApi}
        gallery={[]}
        mod={mod}
        onFocusList={onFocusList}
        onPick={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return client;
};

describe("ModDetails", () => {
  beforeEach(() => {
    mocks.pending = [];
  });

  it("shows what the search returned while the mod loads", () => {
    renderComponent();

    expect(screen.getByText("schlangster")).toBeInTheDocument();
    expect(screen.getByText("User Interface")).toBeInTheDocument();
    expect(screen.getByText("1k")).toBeInTheDocument();
    expect(screen.queryByText("better")).not.toBeInTheDocument();
  });

  it("holds the gallery's place, pulsing, until the mod's pictures load", async () => {
    renderComponent();
    const placeholders = () => document.querySelectorAll("[data-gallery-placeholder]");

    expect(placeholders()).toHaveLength(6);
    expect(placeholders()[0]).toHaveClass("animate-pulse");

    await respond(makeMod());

    await waitFor(() => expect(placeholders()).toHaveLength(0));
  });

  it("shows the mod's description and tags once it loads", async () => {
    renderComponent();
    await respond(makeMod());

    expect(await screen.findByText("better")).toBeInTheDocument();
    expect(screen.getByText("Tag 1")).toBeInTheDocument();
    expect(screen.getByText("Tag 2")).toBeInTheDocument();
  });

  it("shows up to three tags as they are", async () => {
    renderComponent();
    await respond(makeMod({ tags: tags(3) }));

    expect(await screen.findByText("Tag 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+{{count}} more" })).not.toBeInTheDocument();
  });

  it("shows two of more than three tags, and the rest from their count", async () => {
    renderComponent();
    await respond(makeMod({ tags: tags(4) }));

    expect(await screen.findByText("Tag 2")).toBeInTheDocument();
    expect(screen.queryByText("Tag 3")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "+{{count}} more" }));

    const all = await screen.findByRole("list", { name: "Tags" });
    expect(
      within(all)
        .getAllByRole("listitem")
        .map((tag) => tag.textContent),
    ).toEqual(["Tag 3", "Tag 4"]);
  });

  it("counts no tags for a mod without any", async () => {
    renderComponent();
    await respond(makeMod({ tags: [] }));

    expect(await screen.findByText("better")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+{{count}} more" })).not.toBeInTheDocument();
  });

  it("shows the Adult pill for an adult mod", () => {
    renderComponent({ ...summary, adult: true } as ModSummary);

    expect(screen.getByText("Adult")).toBeInTheDocument();
  });

  it("keeps the search's counts when the mod's differ", async () => {
    renderComponent();
    await respond(
      makeMod({
        stats: { endorsements: 99000, downloads: 99000, unique_downloads: 99000, views: 0 },
      }),
    );

    expect(await screen.findByText("better")).toBeInTheDocument();
    expect(screen.getByText("schlangster")).toBeInTheDocument();
    expect(screen.getByText("1k")).toBeInTheDocument();
    expect(screen.queryByText("99k")).not.toBeInTheDocument();
  });

  it("says the description couldn't be loaded when the mod fails, keeping the rest", async () => {
    renderComponent();
    await fail();

    expect(
      await screen.findByText("The mod's description couldn't be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByText("schlangster")).toBeInTheDocument();
  });

  it("keeps the description it has when refreshing the mod fails", async () => {
    const client = renderComponent();
    await respond(makeMod());
    expect(await screen.findByText("better")).toBeInTheDocument();

    await act(async () => {
      void client.invalidateQueries();
    });
    await fail();

    expect(await screen.findByText("better")).toBeInTheDocument();
    expect(screen.queryByText("The mod's description couldn't be loaded.")).not.toBeInTheDocument();
  });

  it("asks to move focus back to the list on Left", async () => {
    const onFocusList = vi.fn();
    renderComponent(summary, onFocusList);
    act(() => screen.getByRole("button", { name: "Open mod page" }).focus());

    await userEvent.keyboard("{ArrowLeft}");

    expect(onFocusList).toHaveBeenCalled();
  });

  it("keeps its tabs and buttons above the part that scrolls, so they stay put", () => {
    renderComponent();
    const scrollArea = screen
      .getByRole("region", { name: "Mod details" })
      .querySelector<HTMLElement>('[tabindex="-1"]');

    expect(scrollArea).toHaveClass("overflow-y-auto");
    expect(scrollArea).not.toContainElement(screen.getByRole("tab", { name: "Details" }));
    expect(scrollArea).not.toContainElement(screen.getByRole("button", { name: "Open mod page" }));
  });

  it("asks to move focus back to the list on Left from the pane itself", async () => {
    const onFocusList = vi.fn();
    renderComponent(summary, onFocusList);
    act(() =>
      screen
        .getByRole("region", { name: "Mod details" })
        .querySelector<HTMLElement>('[tabindex="-1"]')!
        .focus(),
    );

    await userEvent.keyboard("{ArrowLeft}");

    expect(onFocusList).toHaveBeenCalled();
  });

  it.each([
    [
      "from the tabs, which use it",
      "{ArrowLeft}",
      () => screen.getByRole("tab", { name: "Details" }),
    ],
    [
      "with a modifier held",
      "{Shift>}{ArrowLeft}{/Shift}",
      () => screen.getByRole("button", { name: "Open mod page" }),
    ],
  ])("keeps focus on Left %s", async (_name, keys, focused) => {
    const onFocusList = vi.fn();
    renderComponent(summary, onFocusList);
    act(() => focused().focus());

    await userEvent.keyboard(keys);

    expect(onFocusList).not.toHaveBeenCalled();
  });
});
