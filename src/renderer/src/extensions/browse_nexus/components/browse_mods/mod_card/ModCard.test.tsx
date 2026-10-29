import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import { ModCard } from "./ModCard";

// No one's logged in, so adult content is blurred, as it is by default.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

const mod = (adult: boolean) =>
  ({
    id: "1",
    name: "SkyUI",
    summary: "Elegant, PC-friendly interface",
    author: { name: "schlangster" },
    thumbnail_url: "thumb.png",
    blurred_thumbnail_url: "thumb-blurred.png",
    downloads: 9000,
    endorsements: 1234,
    updated_at: "2021-01-01T00:00:00Z",
    adult,
  }) as unknown as ModSummary;

const renderCard = (adult: boolean) =>
  render(<ModCard isActive={false} mod={mod(adult)} tabIndex={0} onSelect={vi.fn()} />);

describe("ModCard", () => {
  it("shows an adult mod's thumbnail as the server blurred it, blurring it no further", () => {
    const { container } = renderCard(true);
    const image = container.querySelector("img");

    expect(image).toHaveAttribute("src", "thumb-blurred.png");
    expect(image).not.toHaveClass("nxm-image-media-blurred");
  });

  it("shows any other mod's thumbnail as it is", () => {
    const { container } = renderCard(false);

    expect(container.querySelector("img")).toHaveAttribute("src", "thumb.png");
  });
});
