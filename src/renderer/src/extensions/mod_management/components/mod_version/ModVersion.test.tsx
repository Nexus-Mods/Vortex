import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IMod } from "../../types/IMod";

// A mod with "update" in its id has something to say about updating; the rest don't.
vi.mock("../mod_update/ModUpdate", () => ({
  ModUpdate: ({ mod }: { mod: IMod }) => <span>update of {mod.id}</span>,
  modUpdateShows: (mod: IMod) => mod.id.includes("update"),
}));

vi.mock("../collection_revision/CollectionRevision", () => ({
  CollectionRevision: ({ collection }: { collection: IMod }) => (
    <span>revision of {collection.id}</span>
  ),
}));

import { ModVersion, modVersionText } from "./ModVersion";

const mod = (id: string, version: string, variant?: string, type = "") =>
  ({ id, type, attributes: { version, variant } }) as unknown as IMod;

const t = ((key: string) => key) as never;

describe("ModVersion", () => {
  it("shows the version of a mod with only the one, then what it says about updating", () => {
    render(<ModVersion mod={mod("a", "1.0.0")} onSelect={vi.fn()} />);

    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("update of a")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("fixes the version's width and truncates it while buttons follow it, so theirs line up", () => {
    const { rerender } = render(<ModVersion mod={mod("plain", "1.0.0")} onSelect={vi.fn()} />);
    expect(screen.getByText("1.0.0")).not.toHaveClass("w-8");

    rerender(<ModVersion mod={mod("has-update", "1.0.0-beta.2")} onSelect={vi.fn()} />);
    expect(screen.getByText("1.0.0-beta.2")).toHaveClass("w-8", "truncate");
  });

  it("shows a collection's revision", () => {
    render(<ModVersion mod={mod("coll", "10", undefined, "collection")} onSelect={vi.fn()} />);

    expect(screen.getByText("revision of coll")).toBeInTheDocument();
  });

  it("switches between a mod's versions and variants from a dropdown", async () => {
    const onSelect = vi.fn();
    const current = mod("a", "1.1.15", "My multiplayer profile");
    render(
      <ModVersion alternatives={[current, mod("b", "1.1.14")]} mod={current} onSelect={onSelect} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "1.1.15 (My multiplayer profile)" }));
    const options = screen.getAllByRole("menuitemradio");
    expect(options.map((option) => option.textContent)).toEqual([
      "1.1.15 (My multiplayer profile)",
      "1.1.14 (default)",
    ]);
    // The one in use checked.
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);

    await userEvent.click(screen.getByRole("menuitemradio", { name: "1.1.14 (default)" }));
    expect(onSelect).toHaveBeenCalledWith("a", "b");
  });

  describe("removing a version", () => {
    const renderRemovable = () => {
      const onSelect = vi.fn();
      const onRemove = vi.fn();
      const current = mod("a", "2.0");
      render(
        <ModVersion
          alternatives={[current, mod("b", "1.0")]}
          mod={current}
          onRemove={onRemove}
          onSelect={onSelect}
        />,
      );
      return { onSelect, onRemove };
    };

    const openPicker = () => userEvent.click(screen.getByRole("button", { name: "2.0 (default)" }));

    const removeIn = (name: string) =>
      within(
        screen.getByRole("menuitemradio", { name: new RegExp(name.replace(/[()]/g, "\\$&")) }),
      ).getByRole("button", { name: "Remove version" });

    it("removes one from its row's button, without switching to it, and closes", async () => {
      const { onSelect, onRemove } = renderRemovable();

      await openPicker();
      await userEvent.click(removeIn("1.0 (default)"));

      expect(onRemove).toHaveBeenCalledWith("b");
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("removes the one in use too", async () => {
      const { onRemove } = renderRemovable();

      await openPicker();
      await userEvent.click(removeIn("2.0 (default)"));

      expect(onRemove).toHaveBeenCalledWith("a");
    });

    it("reaches the remove button from the keyboard, on the row the keyboard is on", async () => {
      const { onRemove } = renderRemovable();

      await openPicker();
      await userEvent.keyboard("{ArrowDown}{Tab}{Enter}");

      expect(onRemove).toHaveBeenCalledWith("b");
    });

    it("offers none to remove when it can't", async () => {
      const current = mod("a", "2.0");
      render(
        <ModVersion alternatives={[current, mod("b", "1.0")]} mod={current} onSelect={vi.fn()} />,
      );

      await openPicker();

      expect(screen.queryByRole("button", { name: "Remove version" })).toBeNull();
    });
  });

  it("calls a variant with an empty name the default", () => {
    const current = mod("a", "1.28.4", "");

    expect(modVersionText(current, [current, mod("b", "1.28.3")], t)).toBe("1.28.4 (default)");
  });

  it("is searched by what it shows", () => {
    const current = mod("a", "1.1.15", "Lite");

    expect(modVersionText(current, undefined, t)).toBe("1.1.15");
    expect(modVersionText(current, [current, mod("b", "1.0")], t)).toBe("1.1.15 (Lite)");
  });
});
