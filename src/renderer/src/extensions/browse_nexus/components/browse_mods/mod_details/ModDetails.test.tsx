import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Mod } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
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

// The install button has tests of its own.
vi.mock("./mod_install_button/ModInstallButton", () => ({ ModInstallButton: () => null }));
vi.mock("../../../hooks/use_mod_status/useModStatus.hook", () => ({
  useModStatus: () => ({ installState: { kind: "none" }, status: "update" }),
}));

import type { IGalleryImage } from "./mod_gallery/ModGallery";
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

/** One of a mod's pictures, in each size. */
const image = (name: string) =>
  ({
    id: name,
    url: `${name}.png`,
    thumbnail_url: `${name}-thumb.png`,
    large_thumbnail_url: `${name}-large.png`,
    blurred_thumbnail_url: `${name}-blurred.png`,
    blurred_large_thumbnail_url: `${name}-blurred-large.png`,
  }) as unknown as IGalleryImage;

let tracking: ReturnType<typeof browseModsTracking>;

/** The properties of the events of one name. */
const propertiesOf = (eventName: string) =>
  tracking.tracked(eventName).map(({ properties }) => properties);

const renderComponent = (mod = summary, onFocusList = vi.fn(), gallery: IGalleryImage[] = []) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  tracking = browseModsTracking();
  render(
    <QueryClientProvider client={client}>
      <ModDetails
        api={{} as IExtensionApi}
        gallery={gallery}
        mod={mod}
        onFocusList={onFocusList}
        onPick={vi.fn()}
      />
    </QueryClientProvider>,
    { wrapper: tracking.wrapper },
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

  it("titles the details with the mod's name, as a heading", () => {
    renderComponent();

    const title = screen.getByTestId("mod-details-title");
    expect(title.tagName).toBe("H2");
    expect(title).toHaveTextContent(summary.name);
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

  it("says what the user has of the mod", () => {
    renderComponent();

    expect(screen.getByText("Update available")).toBeInTheDocument();
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

  it("counts opening the mod page", async () => {
    const openUrl = vi.fn();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
    renderComponent();

    await userEvent.click(screen.getByRole("button", { name: "Open mod page" }));

    expect(openUrl).toHaveBeenCalledWith("https://www.nexusmods.com/skyrimspecialedition/mods/1");
    expect(propertiesOf("browse_mods_mod_page_opened")).toEqual([{ mod_uid: "1704-1" }]);
    vi.unstubAllGlobals();
  });

  it("counts picking a picture in the gallery", async () => {
    renderComponent(summary, vi.fn(), [image("a"), image("b")]);

    await userEvent.click(screen.getAllByRole("button", { name: /^Image/ })[1]);

    expect(propertiesOf("browse_mods_gallery_image_selected")).toEqual([
      { mod_uid: "1704-1", image_index: 2, image_count: 2, input: "pointer" },
    ]);
  });

  it("counts picking a picture with the keys as the keyboard", async () => {
    renderComponent(summary, vi.fn(), [image("a"), image("b")]);
    act(() => screen.getAllByRole("button", { name: /^Image/ })[0].focus());

    await userEvent.keyboard("{ArrowRight}");

    expect(propertiesOf("browse_mods_gallery_image_selected")).toEqual([
      { mod_uid: "1704-1", image_index: 2, image_count: 2, input: "keyboard" },
    ]);
  });

  it("counts paging the gallery's strip, and which way", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly onResize: () => void) {}
        observe = () => this.onResize();
        disconnect = () => undefined;
      },
    );
    const sizes = { scrollWidth: 1000, clientWidth: 200 };
    const restore = Object.entries(sizes).map(([key, value]) => {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
      Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value });
      return () => original && Object.defineProperty(HTMLElement.prototype, key, original);
    });
    const { scrollBy } = HTMLElement.prototype;
    HTMLElement.prototype.scrollBy = vi.fn();

    try {
      renderComponent(summary, vi.fn(), ["a", "b", "c", "d", "e", "f"].map(image));

      await userEvent.click(await screen.findByRole("button", { name: "Later images" }));

      expect(propertiesOf("browse_mods_gallery_paged")).toEqual([
        { mod_uid: "1704-1", direction: "forward" },
      ]);
    } finally {
      restore.forEach((undo) => undo());
      HTMLElement.prototype.scrollBy = scrollBy;
      vi.unstubAllGlobals();
    }
  });

  describe("external images in the description", () => {
    const imgur = (name: string) => `[img]https://i.imgur.com/${name}.png[/img]`;
    const description = [
      `${imgur("a")}\n${imgur("b")}`,
      "Some text between.",
      `[url=https://discord.gg/abc]${imgur("c")}[/url]`,
    ].join("\n");

    it("counts them once for the mod, with how many placeholders they took", async () => {
      renderComponent();
      await respond(makeMod({ description }));

      await waitFor(() =>
        expect(propertiesOf("browse_mods_external_images_shown")).toEqual([
          { mod_uid: "1704-1", image_count: 3, placeholder_count: 2 },
        ]),
      );
    });

    it("counts opening the mod page, Why? and an image's link from them", async () => {
      const openUrl = vi.fn();
      vi.stubGlobal("api", { ...window.api, shell: { openUrl } });

      try {
        renderComponent();
        await respond(makeMod({ description }));

        await userEvent.click(
          (await screen.findAllByRole("button", { name: "View on website" }))[0],
        );
        await userEvent.click(screen.getByRole("button", { name: "discord.gg" }));
        await userEvent.click(screen.getAllByRole("button", { name: "Why?" })[0]);

        expect(openUrl).toHaveBeenCalledWith(
          "https://www.nexusmods.com/skyrimspecialedition/mods/1",
        );
        expect(propertiesOf("browse_mods_external_images_website_opened")).toEqual([
          { mod_uid: "1704-1", image_count: 2, source: "placeholder" },
        ]);
        expect(propertiesOf("browse_mods_external_images_why_opened")).toEqual([
          { mod_uid: "1704-1" },
        ]);
        expect(propertiesOf("browse_mods_external_image_link_opened")).toEqual([
          { mod_uid: "1704-1", link_domain: "discord.gg" },
        ]);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
