import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { CollectionTile, type ICollectionTileProps } from "./CollectionTile";

// Isolate the tile from heavy app utilities — none are exercised by these tests.
vi.mock("@/util/Debouncer", () => ({
  default: class {
    schedule() {
      return undefined;
    }
  },
}));
vi.mock("@/util/util", () => ({ delayed: () => Promise.resolve() }));
vi.mock("@/util/selectors", () => ({ isCollectionModPresent: () => false }));

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const makeCollection = (overrides: Record<string, unknown> = {}) =>
  ({
    badges: [],
    category: { name: "Gameplay" },
    endorsements: 1234,
    latestPublishedRevision: { adultContent: false, modCount: 42, totalSize: 1024 },
    name: "My Collection",
    slug: "my-collection",
    summary: "A great collection of mods.",
    tileImage: { thumbnailUrl: "tile.png" },
    user: { avatar: "avatar.png", name: "Author Name" },
    ...overrides,
  }) as unknown as ICollectionTileProps["collection"];

// state present so the canBeAdded/login logic runs
const makeApi = () => ({ getState: () => ({}) }) as unknown as IExtensionApi;

const renderTile = (props: Partial<ICollectionTileProps> = {}) =>
  render(<CollectionTile api={makeApi()} collection={makeCollection()} {...props} />);

// --- Tests ---

describe("CollectionTile", () => {
  describe("content", () => {
    it("renders the collection name, author, category and summary", () => {
      renderTile();
      expect(screen.getByText("My Collection")).toBeInTheDocument();
      expect(screen.getByText("Author Name")).toBeInTheDocument();
      expect(screen.getByText("Gameplay")).toBeInTheDocument();
      expect(screen.getByText("A great collection of mods.")).toBeInTheDocument();
    });

    it("renders the tile image with the collection name as alt text", () => {
      renderTile();
      expect(screen.getByRole("img", { name: "My Collection" })).toBeInTheDocument();
    });

    it("does not show the Adult label for non-adult collections", () => {
      renderTile();
      expect(screen.queryByText("Adult")).not.toBeInTheDocument();
    });

    it("shows the Adult label for adult collections", () => {
      render(
        <CollectionTile
          api={makeApi()}
          collection={makeCollection({
            latestPublishedRevision: { adultContent: true, modCount: 1, totalSize: 1 },
          })}
        />,
      );
      expect(screen.getByText("Adult")).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("calls onViewPage when the view page button is clicked", async () => {
      const onViewPage = vi.fn();
      renderTile({ onViewPage });
      await userEvent.click(screen.getByRole("button", { name: /view page/i }));
      expect(onViewPage).toHaveBeenCalledOnce();
    });

    it("offers the add-collection action when logged in", () => {
      renderTile({ isLoggedIn: true });
      expect(screen.getByRole("button", { name: /add collection/i })).toBeInTheDocument();
    });

    it("prompts to log in when logged out", () => {
      renderTile({ isLoggedIn: false });
      expect(screen.getByRole("button", { name: /log in to add/i })).toBeInTheDocument();
    });
  });
});
