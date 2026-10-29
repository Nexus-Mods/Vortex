import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Mod } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import type { IModSearch } from "../../hooks/use_mod_search/useModSearch.hook";

// The list, bar, backdrop and details are stood in for: these test which mod the details show.
vi.mock("./browse_mods_bar/BrowseModsBar", () => ({ BrowseModsBar: () => null }));
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
      <div ref={ref}>
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
    onSelectMod,
  }: {
    mods: ModSummary[];
    activeModId: string;
    listRef: React.RefObject<HTMLDivElement>;
    onSelectMod: (id: string) => void;
  }) => (
    <div ref={listRef}>
      {mods.map((mod) => (
        <button
          data-mod-card
          key={mod.id}
          tabIndex={mod.id === activeModId ? 0 : -1}
          onClick={() => onSelectMod(mod.id)}
        >
          {mod.name}
        </button>
      ))}
    </div>
  ),
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

const search = (mods: ModSummary[], loading = false) => ({ mods, loading }) as IModSearch;

const renderComponent = (initial: IModSearch) => {
  const api = {} as IExtensionApi;
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  const wrap = (search: IModSearch) => (
    <QueryClientProvider client={client}>
      <BrowseMods api={api} search={search} />
    </QueryClientProvider>
  );
  const { rerender } = render(wrap(initial));
  return { rerender: (next: IModSearch) => rerender(wrap(next)) };
};

describe("BrowseMods", () => {
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

  it("keeps the picked mod through a change of page", async () => {
    const { rerender } = renderComponent(search([mod("1"), mod("2")]));
    await userEvent.click(screen.getByRole("button", { name: "Mod 2" }));

    rerender(search([mod("1"), mod("2")], true));
    rerender(search([mod("3"), mod("4")]));

    expect(screen.getByTestId("details")).toHaveTextContent("Mod 2");
    expect(screen.queryByTestId("details-skeleton")).not.toBeInTheDocument();
  });

  it("keeps the first mod through a change of page when none's been picked", () => {
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
});
