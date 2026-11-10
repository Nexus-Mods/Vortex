import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit } } }),
}));

import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";

import type { IMod } from "../../types/IMod";
import { useCollectionGroupActions } from "./useCollectionGroupActions.hook";

// --- Helpers ---

const collection = { id: "collection" } as IMod;

const action = (id: string): IToolbarAction => ({ id, label: id, onClick: vi.fn() });

const actionsFor = (ids: string[]) => () => ids.map(action);

const render = (ids: string[]) =>
  renderHook(() => useCollectionGroupActions(actionsFor(ids))).result.current(collection);

const ALL = ["Reinstall", "Open on Nexus Mods", "Check for Update", "Apply Collection Rules"];

// --- Tests ---

describe("useCollectionGroupActions", () => {
  beforeEach(() => {
    emit.mockReset();
  });

  it("offers a collection's own actions, in order, by section", () => {
    const actions = render(ALL);

    expect(actions.map(({ id, section }) => [id, section])).toEqual([
      ["view-collection", "view"],
      ["Check for Update", "manage"],
      ["Apply Collection Rules", "manage"],
      ["Open on Nexus Mods", "open"],
      ["remove-collection", "remove"],
    ]);
  });

  it("leaves out a mod's action a collection has no use for", () => {
    expect(render(ALL).map(({ id }) => id)).not.toContain("Reinstall");
  });

  it("leaves out an action the mod doesn't offer", () => {
    const ids = render(["Check for Update"]).map(({ id }) => id);

    expect(ids).not.toContain("Edit Collection");
    expect(ids).toEqual(["view-collection", "Check for Update", "remove-collection"]);
  });

  it("views the collection's page", () => {
    const view = render(ALL).find(({ id }) => id === "view-collection");

    view?.onClick?.();

    expect(emit).toHaveBeenCalledWith("view-collection", "collection");
  });

  it("removes the collection", () => {
    const remove = render(ALL).find(({ id }) => id === "remove-collection");

    remove?.onClick?.();

    expect(emit).toHaveBeenCalledWith("remove-collection", "collection");
  });
});
