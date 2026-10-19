import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import type { IModGroup } from "../../util/mods_table_views/modsTableViews";
import { useGroupEnabled } from "./useGroupEnabled.hook";

// --- Helpers ---

const mod = (id: string, name = id) => ({ id, attributes: { name } }) as IModWithState;

const XENON = mod("x", "Xenon");
const ZINC = mod("z", "Zinc");

// Xenon has Alpha and Beta; Beta is Zinc's too.
const MEMBERSHIPS: { [modId: string]: IMod[] } = { a: [XENON], b: [XENON, ZINC] };

const xenonGroup: IModGroup = {
  id: "x",
  label: "Xenon",
  collection: XENON,
  rows: [
    { mod: mod("a"), name: "a" },
    { mod: mod("b"), name: "b" },
  ],
};

const loneGroup: IModGroup = { id: "lone", label: "Lone", rows: [{ mod: mod("c"), name: "c" }] };

const render = () => {
  const setEnabled = vi.fn();
  const hook = renderHook(() => useGroupEnabled(MEMBERSHIPS, setEnabled));
  return { ...hook, setEnabled };
};

// --- Tests ---

describe("useGroupEnabled", () => {
  it("enables a group's mods and its collection at once", () => {
    const { result, setEnabled } = render();

    act(() => result.current.setGroupEnabled(xenonGroup, true));

    expect(setEnabled).toHaveBeenCalledWith(["x", "a", "b"], true);
    expect(result.current.pending).toBeUndefined();
  });

  it("disables a group that shares no mods at once", () => {
    const { result, setEnabled } = render();

    act(() => result.current.setGroupEnabled(loneGroup, false));

    expect(setEnabled).toHaveBeenCalledWith(["c"], false);
  });

  it("waits to disable a group that shares mods, naming who shares them", () => {
    const { result, setEnabled } = render();

    act(() => result.current.setGroupEnabled(xenonGroup, false));

    expect(setEnabled).not.toHaveBeenCalled();
    expect(result.current.pending?.shared.collections).toEqual(["Zinc"]);
  });

  it("disables every mod of the waiting group", () => {
    const { result, setEnabled } = render();

    act(() => result.current.setGroupEnabled(xenonGroup, false));
    act(() => result.current.disablePending(false));

    expect(setEnabled).toHaveBeenCalledWith(["x", "a", "b"], false);
    expect(result.current.pending).toBeUndefined();
  });

  it("keeps the shared mods of the waiting group on", () => {
    const { result, setEnabled } = render();

    act(() => result.current.setGroupEnabled(xenonGroup, false));
    act(() => result.current.disablePending(true));

    expect(setEnabled).toHaveBeenCalledWith(["x", "a"], false);
  });

  it("drops the waiting group without a change once cancelled", () => {
    const { result, setEnabled } = render();

    act(() => result.current.setGroupEnabled(xenonGroup, false));
    act(() => result.current.cancelPending());

    expect(result.current.pending).toBeUndefined();
    expect(setEnabled).not.toHaveBeenCalled();
  });
});
