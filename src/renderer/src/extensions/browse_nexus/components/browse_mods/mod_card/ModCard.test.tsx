import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import type { ModInstallState } from "../../../hooks/use_mod_install_state/useModInstallState.hook";
import { ModCard } from "./ModCard";

// No one's logged in, so adult content is blurred, as it is by default.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

/** What the user has of the mod the card shows. */
let installState: ModInstallState = { kind: "none" };
vi.mock("../../../hooks/use_mod_install_state/useModInstallState.hook", () => ({
  useModInstallState: () => installState,
}));

const mod = (adult: boolean) =>
  ({
    id: "1",
    name: "SkyUI",
    summary: "Elegant, PC-friendly interface",
    author: { name: "schlangster" },
    game: { domain_name: "skyrimspecialedition" },
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
  afterEach(() => {
    installState = { kind: "none" };
  });

  it.each([
    [{ kind: "downloaded", downloadId: "dl" }, "Downloaded"],
    [{ kind: "installed", mod: { id: "skyui" } }, "Installed"],
    [{ kind: "installed", mod: { id: "skyui" }, update: "update" }, "Update available"],
  ] as Array<[ModInstallState, string]>)("says what the user has of the mod", (state, label) => {
    installState = state;
    renderCard(false);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("says nothing of a mod the user hasn't got", () => {
    renderCard(false);

    expect(screen.queryByText(/Downloaded|Installed|Update available/)).toBeNull();
  });

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

  it.each([
    ["download", "Downloads: {{total}}"],
    ["thumb_up", "Endorsements: {{total}}"],
  ])("says what its %s stat counts, on hover", async (icon, tooltip) => {
    const { container } = renderCard(false);
    const stat = container.querySelector(`[data-symbol="${icon}"]`)?.closest("span.flex");

    await userEvent.hover(stat!);

    expect(await screen.findByText(tooltip)).toBeInTheDocument();
  });

  it("says its date is when the mod was updated, on hover", async () => {
    renderCard(false);

    await userEvent.hover(screen.getByText("{{ count }} year ago"));

    expect(await screen.findByText("Updated {{date}}")).toBeInTheDocument();
  });
});
