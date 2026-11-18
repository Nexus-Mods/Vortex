import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../util/modSource", () => ({
  getModSources: () => [
    { id: "nexus", name: "Nexus Mods" },
    { id: "website", name: "Website" },
  ],
}));

import { MODS_TABLE_TEST_GAME, makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IModWithState } from "../../types/IModProps";
import type { ModProperty } from "../use_mod_properties/useModProperties.hook";
import { useModPropertyEdits } from "./useModPropertyEdits.hook";

const mod = (id: string, attributes: object = {}, state = "installed") =>
  ({ id, type: "", state, attributes }) as unknown as IModWithState;

const renderEdits = (mods: IModWithState[]) => {
  const store = makeModsTableStore({
    categories: {
      "1": { name: "Armour", parentCategory: undefined, order: 1 },
      "2": { name: "Audio", parentCategory: undefined, order: 2 },
    },
  });
  const dispatch = vi.spyOn(store, "dispatch");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = renderHook(() => useModPropertyEdits(mods), { wrapper });
  return { edits: result.current, dispatch };
};

const byId = (properties: ModProperty[], id: string) =>
  properties.find((property) => property.id === id)!;

describe("useModPropertyEdits", () => {
  it("offers the game's categories, with the mod's own picked", () => {
    const category = byId(renderEdits([mod("a", { category: "2" })]).edits.organise, "category");

    expect(category).toMatchObject({ kind: "select", value: "2", isVarious: false });
    expect(category.kind === "select" && category.choices).toEqual([
      { value: "1", label: "Armour" },
      { value: "2", label: "Audio" },
    ]);
  });

  it("reads a category kept as a number, or as several ids, by its first", () => {
    const { edits } = renderEdits([mod("a", { category: 2 })]);
    expect(byId(edits.organise, "category")).toMatchObject({ value: "2" });

    const several = renderEdits([mod("a", { category: "1,2" })]).edits;
    expect(byId(several.organise, "category")).toMatchObject({ value: "1" });
  });

  it("is Various where the selected mods' categories differ", () => {
    const { edits } = renderEdits([mod("a", { category: "1" }), mod("b", { category: "2" })]);

    expect(byId(edits.organise, "category")).toMatchObject({ value: "", isVarious: true });
  });

  it("sets the category of every selected mod, a downloaded one's on its download", () => {
    const { edits, dispatch } = renderEdits([mod("a"), mod("b", {}, "downloaded")]);
    const category = byId(edits.organise, "category");

    act(() => {
      if (category.kind === "select") {
        category.onChange("2");
      }
    });

    expect(dispatch.mock.calls.map(([action]) => action)).toMatchObject([
      {
        type: "SET_MOD_ATTRIBUTE",
        payload: { gameId: MODS_TABLE_TEST_GAME, modId: "a", attribute: "category", value: "2" },
      },
      { type: "SET_DOWNLOAD_MODINFO", payload: { id: "b", key: "custom.category", value: "2" } },
    ]);
  });

  it("saves a note to the mods it's given, not whichever are selected", () => {
    const { edits, dispatch } = renderEdits([mod("a", { notes: "old" })]);
    const notes = byId(edits.organise, "notes");
    expect(notes).toMatchObject({ kind: "notes", value: "old" });

    act(() => {
      if (notes.kind === "notes") {
        notes.onSave(["b", "c"], "new");
      }
    });

    expect(dispatch.mock.calls.map(([action]) => action)).toMatchObject([
      { payload: { modId: "b", attribute: "notes", value: "new" } },
      { payload: { modId: "c", attribute: "notes", value: "new" } },
    ]);
  });

  it("offers notes only while every selected mod is installed, as only those keep notes", () => {
    expect(renderEdits([mod("a", {}, "downloaded")]).edits.organise.map(({ id }) => id)).toEqual([
      "category",
    ]);
    expect(
      renderEdits([mod("a"), mod("b", {}, "downloaded")]).edits.organise.map(({ id }) => id),
    ).toEqual(["category"]);
  });

  it("offers the sources there are, and Website's address only for one installed website mod", () => {
    const website = renderEdits([mod("a", { source: "website", url: "https://example.com" })]);
    expect(byId(website.edits.source, "source")).toMatchObject({ value: "website" });
    expect(byId(website.edits.source, "website")).toMatchObject({
      kind: "url",
      value: "https://example.com",
      modId: "a",
    });

    const nexus = renderEdits([mod("a", { source: "nexus" })]).edits;
    expect(nexus.source.map(({ id }) => id)).toEqual(["source"]);

    const downloaded = renderEdits([mod("a", { source: "website" }, "downloaded")]).edits;
    expect(downloaded.source.map(({ id }) => id)).toEqual(["source"]);

    const several = renderEdits([
      mod("a", { source: "website" }),
      mod("b", { source: "website" }),
    ]).edits;
    expect(several.source.map(({ id }) => id)).toEqual(["source"]);
  });

  it("saves a website mod's address", () => {
    const { edits, dispatch } = renderEdits([mod("a", { source: "website" })]);
    const website = byId(edits.source, "website");

    act(() => {
      if (website.kind === "url") {
        website.onSave("https://example.com/mod");
      }
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ attribute: "url", value: "https://example.com/mod" }),
      }),
    );
  });
});
