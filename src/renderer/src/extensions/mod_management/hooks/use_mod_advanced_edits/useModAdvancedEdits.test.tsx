import { act, renderHook } from "@testing-library/react";
import { VortexGameId } from "@vortex/shared";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  // Lets a test make the game extensions' mod type code throw.
  broken: { getPath: false, isSupported: false },
  log: vi.fn(),
}));

vi.mock("@/util/log", () => ({ log: mocks.log }));

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit: mocks.emit } } }),
}));

// Two types for the test game, one for another game, which isn't offered.
vi.mock("../../../gamemode_management/util/modTypeExtensions", () => {
  const types = [
    {
      typeId: "dinput",
      isSupported: (gameId: VortexGameId) => gameId === VortexGameId("game"),
      options: { name: "Engine injector" },
      getPath: () => "/games/test",
    },
    {
      typeId: "bepinex",
      isSupported: () => true,
      options: {},
      getPath: () => {
        if (mocks.broken.getPath) {
          throw new Error("no documents folder");
        }
        return "/games/test/BepInEx";
      },
    },
    { typeId: "other", isSupported: () => false, options: { name: "Other" }, getPath: () => "" },
    {
      typeId: "fragile",
      isSupported: () => {
        if (mocks.broken.isSupported) {
          throw new Error("registry unreadable");
        }
        return true;
      },
      options: { name: "Fragile" },
      getPath: () => "/games/test/Fragile",
    },
  ];
  return {
    getModTypeExtensions: () => types,
    getModType: (id: string) => types.find(({ typeId }) => typeId === id),
  };
});

vi.mock("../../../gamemode_management/util/getGame", () => ({
  getGame: () => ({ getModPaths: (base: string) => ({ "": `${base}/Mods` }) }),
}));

// The Nexus Mods games list, which the game section offers.
vi.mock("../../../nexus_integration/util", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  nexusGames: () => [
    { id: 1, domain_name: "testgame", name: "Test Game" },
    { id: 2, domain_name: "skyrim", name: "Skyrim" },
    { id: 3, domain_name: "morrowind", name: "Morrowind" },
    { id: 4, domain_name: "skyrimspecialedition", name: "Skyrim Special Edition" },
  ],
}));

import { makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IModWithState } from "../../types/IModProps";
import type { ModProperty } from "../use_mod_properties/useModProperties.hook";
import { useModAdvancedEdits } from "./useModAdvancedEdits.hook";

const mod = (id: string, fields: object = {}, attributes: object = {}) =>
  ({ id, type: "", state: "installed", attributes, ...fields }) as unknown as IModWithState;

const KNOWN = [
  { id: "game", name: "Test Game", nexus: { gameDomain: "testgame" } },
  { id: "skyrim", name: "Skyrim", nexus: { gameDomain: "skyrim" } },
  // Most games carry no Nexus Mods details here, their section being their own id.
  { id: "local", name: "Another Game" },
  // Two games on one site section, only the second installed.
  { id: "skyrimse", name: "Skyrim Special Edition", nexus: { gameDomain: "skyrimspecialedition" } },
  { id: "skyrimvr", name: "Skyrim VR", nexus: { gameDomain: "skyrimspecialedition" } },
];

const renderEdits = (mods: IModWithState[]) => {
  mocks.emit.mockClear();
  const store = makeModsTableStore({
    knownGames: KNOWN,
    discovered: {
      [VortexGameId("game")]: { path: "/games/test" },
      [VortexGameId("skyrimvr")]: { path: "/games/skyrimvr" },
    },
  });
  const dispatch = vi.spyOn(store, "dispatch");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = renderHook(() => useModAdvancedEdits(mods), { wrapper });
  return { edits: result.current, dispatch };
};

const byId = (properties: ModProperty[], id: string) =>
  properties.find((property) => property.id === id);

const ids = (properties: ModProperty[]) => properties.map(({ id }) => id);

describe("useModAdvancedEdits", () => {
  describe("mod type", () => {
    it("offers the game's types, Default when there's none", () => {
      const modType = byId(renderEdits([mod("a")]).edits, "modType");

      expect(modType).toMatchObject({ kind: "select", value: "", emptyLabel: expect.any(String) });
      expect(modType?.kind === "select" && modType.choices).toEqual([
        { value: "dinput", label: "Engine injector" },
        { value: "bepinex", label: "bepinex" },
        { value: "fragile", label: "Fragile" },
      ]);
    });

    it("leaves out where mods deploy when the mod type's getPath throws", () => {
      mocks.broken.getPath = true;
      mocks.log.mockClear();
      try {
        const edits = renderEdits([mod("a", { type: "bepinex" })]).edits;

        expect(byId(edits, "modType")).toMatchObject({ kind: "select", value: "bepinex" });
        expect(byId(edits, "deploysTo")).toBeUndefined();
        expect(mocks.log).toHaveBeenCalledWith(
          "warn",
          expect.any(String),
          expect.objectContaining({ modType: "bepinex", error: "no documents folder" }),
        );
      } finally {
        mocks.broken.getPath = false;
      }
    });

    it("leaves out a mod type whose isSupported throws", () => {
      mocks.broken.isSupported = true;
      mocks.log.mockClear();
      try {
        const modType = byId(renderEdits([mod("a")]).edits, "modType");

        expect(modType?.kind === "select" && modType.choices).toEqual([
          { value: "dinput", label: "Engine injector" },
          { value: "bepinex", label: "bepinex" },
        ]);
        expect(mocks.log).toHaveBeenCalledWith(
          "warn",
          expect.any(String),
          expect.objectContaining({ modType: "fragile", error: "registry unreadable" }),
        );
      } finally {
        mocks.broken.isSupported = false;
      }
    });

    it("says where a mod deploys, and its type's id to copy", () => {
      const defaulted = renderEdits([mod("a")]).edits;
      expect(byId(defaulted, "deploysTo")).toMatchObject({ value: "/games/test/Mods" });
      expect(byId(defaulted, "modTypeId")).toBeUndefined();

      const typed = renderEdits([mod("a", { type: "bepinex" })]).edits;
      expect(byId(typed, "deploysTo")).toMatchObject({ value: "/games/test/BepInEx" });
      expect(byId(typed, "modTypeId")).toMatchObject({ value: "bepinex", copyable: true });
    });

    it("sets every selected mod's type, then has their conflicts worked out again", () => {
      const { edits, dispatch } = renderEdits([mod("a"), mod("b")]);
      const modType = byId(edits, "modType");

      act(() => {
        if (modType?.kind === "select") {
          modType.onChange("dinput");
        }
      });

      expect(dispatch.mock.calls.map(([action]) => action)).toMatchObject([
        { type: "SET_MOD_TYPE", payload: { gameId: "game", modId: "a", type: "dinput" } },
        { type: "SET_MOD_TYPE", payload: { modId: "b", type: "dinput" } },
      ]);
      expect(mocks.emit).toHaveBeenCalledWith("recalculate-modtype-conflicts", ["a", "b"]);
    });

    it("is Various where the mods' types differ, with nowhere to say they deploy", () => {
      const edits = renderEdits([mod("a"), mod("b", { type: "dinput" })]).edits;

      expect(byId(edits, "modType")).toMatchObject({ value: "", isVarious: true });
      expect(ids(edits)).toEqual(["modType"]);
    });

    it("is offered only while every selected mod is installed", () => {
      expect(ids(renderEdits([mod("a", { state: "downloaded" })]).edits)).not.toContain("modType");
      expect(ids(renderEdits([mod("a"), mod("b", { state: "downloaded" })]).edits)).toEqual([]);
    });
  });

  describe("game section", () => {
    const nexusMod = (attributes: object = {}, fields: object = {}) =>
      mod("a", fields, { source: "nexus", ...attributes });

    it("offers every Nexus Mods game, by name, the active one's by default, never none", () => {
      const section = byId(renderEdits([nexusMod()]).edits, "gameSection");

      expect(section).toMatchObject({
        kind: "select",
        value: "testgame",
        required: true,
        disabled: false,
      });
      expect(section?.kind === "select" && section.choices).toEqual([
        { value: "morrowind", label: "Morrowind" },
        { value: "skyrim", label: "Skyrim" },
        { value: "skyrimspecialedition", label: "Skyrim Special Edition" },
        { value: "testgame", label: "Test Game" },
      ]);
    });

    it("shows the section a mod was downloaded from, kept alone or first in a list", () => {
      expect(
        byId(renderEdits([nexusMod({ downloadGame: "skyrim" })]).edits, "gameSection"),
      ).toMatchObject({
        value: "skyrim",
      });
      expect(
        byId(renderEdits([nexusMod({ downloadGame: ["skyrim", "game"] })]).edits, "gameSection"),
      ).toMatchObject({ value: "skyrim" });
    });

    it("shows a section with no Vortex game as it's kept", () => {
      expect(
        byId(renderEdits([nexusMod({ downloadGame: "morrowind" })]).edits, "gameSection"),
      ).toMatchObject({ value: "morrowind" });
    });

    it("names a game Vortex knows with no Nexus Mods section yet, without guessing one", () => {
      expect(
        byId(renderEdits([nexusMod({ downloadGame: "local" })]).edits, "gameSection"),
      ).toMatchObject({ value: "", valueLabel: "Another Game" });
    });

    it("shows no section for one kept that's neither a game Vortex knows nor on the site", () => {
      expect(
        byId(renderEdits([nexusMod({ downloadGame: "gone" })]).edits, "gameSection"),
      ).toMatchObject({ value: "" });
    });

    it.each([
      ["a game Vortex knows, as its id", "testgame", "game"],
      ["one it doesn't, under its domain", "morrowind", "morrowind"],
      ["the installed one of two games sharing it", "skyrimspecialedition", "skyrimvr"],
    ])("saves the section picked: %s", (_, domain, saved) => {
      const { edits, dispatch } = renderEdits([nexusMod()]);
      const section = byId(edits, "gameSection");

      act(() => {
        if (section?.kind === "select") {
          section.onChange(domain);
        }
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ attribute: "downloadGame", value: saved }),
        }),
      );
    });

    it("can't be changed for a downloaded mod, and isn't there for one from elsewhere", () => {
      const downloaded = renderEdits([nexusMod({}, { state: "downloaded" })]).edits;
      expect(byId(downloaded, "gameSection")).toMatchObject({ disabled: true });

      expect(byId(renderEdits([mod("a")]).edits, "gameSection")).toBeUndefined();
    });

    it("is for one mod at a time", () => {
      const edits = renderEdits([nexusMod(), mod("b", {}, { source: "nexus" })]).edits;

      expect(byId(edits, "gameSection")).toBeUndefined();
    });
  });
});
