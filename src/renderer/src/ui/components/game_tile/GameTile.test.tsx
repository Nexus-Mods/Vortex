import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/ui/components/button/Button";

import { GameTile } from "./GameTile";

const menu = {
  label: "Game options",
  actions: [[{ iconPath: "mdi-test", label: "Game details", onClick: () => undefined }]],
};

describe("GameTile", () => {
  it("shows the game's name and art", () => {
    render(<GameTile imageUrl="file:///art.png" name="Skyrim Special Edition" />);

    expect(screen.getByText("Skyrim Special Edition")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Skyrim Special Edition" })).toHaveAttribute(
      "src",
      "file:///art.png",
    );
  });

  it("runs the primary action when it's used", async () => {
    const onClick = vi.fn();

    render(
      <GameTile
        name="Skyrim Special Edition"
        primaryAction={<Button onClick={onClick}>Add game</Button>}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add game" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("opens the menu from the overflow button", async () => {
    render(<GameTile menu={menu} name="Skyrim Special Edition" />);

    expect(screen.queryByText("Game details")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Game options" }));

    expect(await screen.findByText("Game details")).toBeInTheDocument();
  });

  it("stays the active tile while its menu is open", async () => {
    render(<GameTile menu={menu} name="Skyrim Special Edition" />);

    // The reveals are CSS keyed off this attribute, which is the tile's way of saying
    // it's still the one being worked on once the portalled menu has taken the pointer.
    const tile = () => document.querySelector(".group\\/tile");

    expect(tile()).not.toHaveAttribute("data-menu-open");

    await userEvent.click(screen.getByRole("button", { name: "Game options" }));

    expect(tile()).toHaveAttribute("data-menu-open");
  });

  it("has no overflow button when there's no menu", () => {
    render(<GameTile name="Skyrim Special Edition" />);

    expect(screen.queryByRole("button", { name: "Game options" })).not.toBeInTheDocument();
  });

  it.each([
    ["steam", "Steam"],
    ["gog", "GOG"],
    ["epic", "Epic Games"],
    ["origin", "Origin"],
    ["uplay", "Ubisoft"],
    ["xbox", "Xbox"],
  ])('names the %s store as "%s", with its icon', (store, label) => {
    const { container } = render(<GameTile name="Skyrim Special Edition" store={store} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(".nxm-pill-icon")).toBeInTheDocument();
  });

  // Better a bare id than nothing: the game still says where it came from.
  it("shows a store it doesn't know, capitalised and without an icon", () => {
    const { container } = render(<GameTile name="Skyrim Special Edition" store="tesco" />);

    expect(screen.getByText("Tesco")).toBeInTheDocument();
    expect(container.querySelector(".nxm-pill-icon")).not.toBeInTheDocument();
  });

  it("marks a game whose extension came from the community", async () => {
    render(<GameTile name="Skyrim Special Edition" supportedBy="RyukanoHi" />);

    expect(screen.getByText("Community supported")).toBeInTheDocument();

    // The attribution's wording is i18n's — a key comes back uninterpolated with no
    // provider — so what's asserted is that hovering it attributes the game at all.
    await userEvent.hover(screen.getByText("Community supported"));

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it("says nothing about contributors for a game Vortex ships support for", () => {
    render(<GameTile name="Skyrim Special Edition" />);

    expect(screen.queryByText("Community supported")).not.toBeInTheDocument();
  });
});
