import { describe, expect, it, vi } from "vitest";

vi.mock("@/util/log", () => ({ log: vi.fn() }));

import type { ITableAttribute } from "@/types/ITableAttribute";
import { log } from "@/util/log";

import { listenToExternalData, releaseExternalData } from "./externalDataListeners";

// --- Helpers ---

/**
 * An attribute whose `externalData` keeps only the last listener, as Tracked's and Collections' do.
 */
const attribute = () => {
  const extension = { changed: () => {} };
  const externalData = vi.fn((onChanged: () => void) => {
    extension.changed = onChanged;
  });
  const attr = {
    id: "extra",
    name: "Extra",
    placement: "table",
    edit: {},
    externalData,
  } as ITableAttribute;
  return { attr, externalData, changed: () => extension.changed() };
};

// --- Tests ---

describe("listenToExternalData", () => {
  it("calls externalData once however many listen", () => {
    const { attr, externalData, changed } = attribute();
    const first = vi.fn();
    const second = vi.fn();

    listenToExternalData(attr, first);
    listenToExternalData(attr, second);
    changed();

    expect(externalData).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops telling a listener that unsubscribed", () => {
    const { attr, changed } = attribute();
    const gone = vi.fn();
    const staying = vi.fn();

    const unsubscribe = listenToExternalData(attr, gone);
    listenToExternalData(attr, staying);
    unsubscribe();
    changed();

    expect(gone).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledTimes(1);
  });

  // As the table's columns are listened to again as one is toggled, and the panel's as it opens.
  it("doesn't call externalData again for a listener that comes after all the others went", () => {
    const { attr, externalData, changed } = attribute();
    const later = vi.fn();

    listenToExternalData(attr, vi.fn())();
    listenToExternalData(attr, later);
    changed();

    expect(externalData).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
  });

  // As one extension's bug mustn't keep the table or the panel from hearing of a change.
  it("tells the other listeners, and logs it, when one fails", () => {
    const { attr, changed } = attribute();
    const after = vi.fn();
    listenToExternalData(attr, () => {
      throw new Error("broken");
    });
    listenToExternalData(attr, after);

    changed();

    expect(after).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "error",
      expect.any(String),
      expect.objectContaining({ attribute: "extra", error: "broken" }),
    );
  });

  it("listens to nothing for an attribute with no outside data", () => {
    const attr = { id: "plain", name: "Plain", placement: "table", edit: {} } as ITableAttribute;

    expect(() => listenToExternalData(attr, vi.fn())()).not.toThrow();
  });
});

describe("releaseExternalData", () => {
  // As the legacy table takes the listener of an extension that keeps only the last one.
  it("has the next listener call externalData again", () => {
    const { attr, externalData, changed } = attribute();
    const later = vi.fn();
    listenToExternalData(attr, vi.fn())();

    releaseExternalData(attr);
    listenToExternalData(attr, later);
    changed();

    expect(externalData).toHaveBeenCalledTimes(2);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it("still tells those listening already, as the extension does", () => {
    const { attr, changed } = attribute();
    const listener = vi.fn();
    listenToExternalData(attr, listener);

    releaseExternalData(attr);
    changed();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
