import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMod } from "../../types/IMod";

const revision = vi.hoisted(() => ({
  current: {} as {
    revision: number;
    newest: number;
    hasUpdate: boolean;
    update: () => Promise<void>;
    updating: boolean;
    changelog?: string;
  },
}));

vi.mock("../../hooks/use_collection_revision/useCollectionRevision.hook", () => ({
  useCollectionRevision: () => revision.current,
}));

import { CollectionRevision } from "./CollectionRevision";

const COLLECTION = { id: "coll", type: "collection", attributes: {} } as unknown as IMod;

describe("CollectionRevision", () => {
  beforeEach(() => {
    revision.current = {
      revision: 10,
      newest: 10,
      hasUpdate: false,
      update: vi.fn(),
      updating: false,
    };
  });

  it("shows its revision, with nothing to do while it's the newest", () => {
    render(<CollectionRevision collection={COLLECTION} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("fixes the revision's width while buttons follow it, and not otherwise", () => {
    const { rerender } = render(<CollectionRevision collection={COLLECTION} />);
    expect(screen.getByText("10")).not.toHaveClass("w-8");

    revision.current = { ...revision.current, newest: 11, hasUpdate: true };
    rerender(<CollectionRevision collection={COLLECTION} />);
    expect(screen.getByText("10")).toHaveClass("w-8", "truncate");
  });

  it("updates to a newer revision from its button", async () => {
    const update = vi.fn();
    revision.current = { ...revision.current, newest: 11, hasUpdate: true, update };
    render(<CollectionRevision collection={COLLECTION} />);

    // the test `t` leaves the revision uninterpolated
    await userEvent.click(screen.getByRole("button", { name: "Update to {{revision}}" }));

    expect(update).toHaveBeenCalled();
  });

  it("opens the changelog, while there is one", async () => {
    revision.current = { ...revision.current, changelog: "# Changes\n\nFixed **things**" };
    render(<CollectionRevision collection={COLLECTION} />);

    await userEvent.click(screen.getByRole("button", { name: "View changelog" }));

    expect(screen.getByRole("heading", { name: "Changes" })).toBeInTheDocument();
    expect(screen.getByText("things").tagName).toBe("STRONG");
  });
});
