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

// A minimal, fully-typed stand-in for the fields of ICollection the tile reads,
// so tests can assert against the fixture rather than hardcoded strings.
interface TestCollection {
  badges: { description: string; name: string }[];
  category: { name: string };
  endorsements: number;
  latestPublishedRevision: { adultContent: boolean; modCount: number; totalSize: number };
  name: string;
  slug: string;
  summary: string;
  tileImage: { thumbnailUrl: string };
  user: { avatar: string; name: string };
}

const makeCollection = (overrides: Partial<TestCollection> = {}): TestCollection => ({
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
});

// state present so the canBeAdded/login logic runs
const makeApi = () => ({ getState: () => ({}) }) as unknown as IExtensionApi;

const renderComponent = ({
  collection = makeCollection(),
  isLoggedIn,
}: { collection?: TestCollection; isLoggedIn?: boolean } = {}) => {
  const onAddCollection = vi.fn();
  const onViewPage = vi.fn();

  render(
    <CollectionTile
      api={makeApi()}
      collection={collection as unknown as ICollectionTileProps["collection"]}
      isLoggedIn={isLoggedIn}
      onAddCollection={onAddCollection}
      onViewPage={onViewPage}
    />,
  );

  return { collection, onAddCollection, onViewPage };
};

// --- Tests ---

describe("CollectionTile", () => {
  describe("content", () => {
    it("renders the collection name, author, category and summary", () => {
      const { collection } = renderComponent();
      expect(screen.getByText(collection.name)).toBeInTheDocument();
      expect(screen.getByText(collection.user.name)).toBeInTheDocument();
      expect(screen.getByText(collection.category.name)).toBeInTheDocument();
      expect(screen.getByText(collection.summary)).toBeInTheDocument();
    });

    it("renders the tile image with the collection name as alt text", () => {
      const { collection } = renderComponent();
      expect(screen.getByRole("img", { name: collection.name })).toBeInTheDocument();
    });

    it("does not show the Adult label for non-adult collections", () => {
      renderComponent();
      expect(screen.queryByText("Adult")).not.toBeInTheDocument();
    });

    it("shows the Adult label for adult collections", () => {
      const collection = makeCollection({
        latestPublishedRevision: { adultContent: true, modCount: 1, totalSize: 1 },
      });
      renderComponent({ collection });
      expect(screen.getByText("Adult")).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("calls onViewPage when the view page button is clicked", async () => {
      const { onViewPage } = renderComponent();
      await userEvent.click(screen.getByRole("button", { name: /view page/i }));
      expect(onViewPage).toHaveBeenCalledOnce();
    });

    it("offers the add-collection action when logged in", () => {
      renderComponent({ isLoggedIn: true });
      expect(screen.getByRole("button", { name: /add collection/i })).toBeInTheDocument();
    });

    it("prompts to log in when logged out", () => {
      renderComponent({ isLoggedIn: false });
      expect(screen.getByRole("button", { name: /log in to add/i })).toBeInTheDocument();
    });
  });
});
