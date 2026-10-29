import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

const mocks = vi.hoisted(() => ({ mods: {} as Record<string, unknown> }));

vi.mock("@/extensions/nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({
    getModById: (id: string) =>
      id in mocks.mods ? Promise.resolve(mocks.mods[id]) : new Promise(() => undefined),
  }),
}));

import { useModGallery } from "./useModGallery.hook";

const summary = (id: string, thumbnail_url: string | null = "thumb.png") =>
  ({
    id,
    thumbnail_url,
    blurred_thumbnail_url: thumbnail_url && thumbnail_url.replace(".png", "-blurred.png"),
  }) as ModSummary;

const primary = (name: string) => ({
  url: `${name}.png`,
  thumbnail_url: `${name}-thumb.png`,
  large_thumbnail_url: `${name}-large.png`,
  blurred_thumbnail_url: `${name}-blurred.png`,
  blurred_large_thumbnail_url: `${name}-blurred-large.png`,
});

const image = (name: string, title = "") => ({ ...primary(name), id: name, title });

const renderGallery = (mod?: ModSummary) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    (props: { mod?: ModSummary }) => useModGallery({} as IExtensionApi, props.mod),
    {
      initialProps: { mod },
      wrapper,
    },
  );
};

/** Renders the mod's gallery and waits for its own images to arrive. */
const loadedGallery = async (mod: ModSummary) => {
  const view = renderGallery(mod);
  await waitFor(() =>
    expect(view.result.current.gallery[0]?.large_thumbnail_url).not.toBe("thumb.png"),
  );
  return view;
};

describe("useModGallery", () => {
  beforeEach(() => {
    mocks.mods = {};
  });

  it("has no gallery or backdrop without a mod", () => {
    const { result } = renderGallery();

    expect(result.current.gallery).toEqual([]);
    expect(result.current.backdrop).toBeUndefined();
  });

  it("shows the search's thumbnail until the mod's own images arrive", () => {
    expect(renderGallery(summary("1")).result.current.gallery).toEqual([
      {
        url: "thumb.png",
        thumbnail_url: "thumb.png",
        large_thumbnail_url: "thumb.png",
        blurred_thumbnail_url: "thumb-blurred.png",
        blurred_large_thumbnail_url: "thumb-blurred.png",
      },
    ]);
    expect(renderGallery(summary("1", null)).result.current.gallery).toEqual([]);
  });

  it("shows the gallery in the authors' order, titled, with the first behind", async () => {
    mocks.mods["1"] = {
      primary_image: primary("a"),
      gallery_images: [image("a", "Front"), image("b")],
    };

    const { result } = await loadedGallery(summary("1"));

    expect(result.current.gallery).toEqual([image("a", "Front"), image("b")]);
    expect(result.current.backdrop).toBe(result.current.gallery[0]);
  });

  it("puts the primary image first when the gallery doesn't have it", async () => {
    mocks.mods["1"] = { primary_image: primary("p"), gallery_images: [image("a")] };

    const { result } = await loadedGallery(summary("1"));

    expect(result.current.gallery).toEqual([primary("p"), image("a")]);
  });

  it("shows nothing for a mod with no images", async () => {
    mocks.mods["1"] = { primary_image: null, gallery_images: [] };

    const { result } = renderGallery(summary("1"));

    await waitFor(() => expect(result.current.gallery).toEqual([]));
    expect(result.current.backdrop).toBeUndefined();
  });

  it("puts the picked image behind, until another mod opens", async () => {
    mocks.mods["1"] = { primary_image: null, gallery_images: [image("a"), image("b")] };
    mocks.mods["2"] = { primary_image: null, gallery_images: [image("c")] };
    const { result, rerender } = await loadedGallery(summary("1"));

    act(() => result.current.setBackdrop(result.current.gallery[1]));
    expect(result.current.backdrop?.url).toBe("b.png");

    rerender({ mod: summary("2") });
    await waitFor(() => expect(result.current.backdrop?.url).toBe("c.png"));
  });
});
