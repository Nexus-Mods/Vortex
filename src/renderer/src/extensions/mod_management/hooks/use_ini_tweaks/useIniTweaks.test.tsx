import * as path from "node:path";

import { act, renderHook, waitFor } from "@testing-library/react";
import { QualifiedPath } from "@vortex/shared/filesystem";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

const STAGING = path.resolve("/staging");

vi.mock("../../selectors", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  installPath: () => STAGING,
}));

import { installInMemoryFS, type InstalledInMemoryFS } from "@/test-utils/fsApi";
import { makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IModWithState } from "../../types/IModProps";
import { useIniTweaks } from "./useIniTweaks.hook";

const mod = (fields: object = {}) =>
  ({
    id: "a",
    type: "",
    state: "installed",
    installationPath: "SkyUI",
    attributes: {},
    ...fields,
  }) as unknown as IModWithState;

const tweak = (name: string) =>
  QualifiedPath.fromNative(path.join(STAGING, "SkyUI", "Ini Tweaks", name));

// Each render's file system, put back last first, so none outlives its test.
const installed: InstalledInMemoryFS[] = [];

const renderTweaks = (mods: IModWithState[], files: string[] = []) => {
  installed.push(
    installInMemoryFS((builder) => {
      files.forEach((name) => builder.file(tweak(name), { type: "text", data: "[Display]" }));
    }),
  );
  const store = makeModsTableStore();
  const dispatch = vi.spyOn(store, "dispatch");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = renderHook(() => useIniTweaks(mods), { wrapper });
  return { result, dispatch };
};

describe("useIniTweaks", () => {
  afterEach(() => {
    installed
      .splice(0)
      .reverse()
      .forEach(({ restore }) => restore());
  });

  it("offers a switch for each optional INI edit, named without its INI, on for those it has on", async () => {
    const { result } = renderTweaks(
      [mod({ enabledINITweaks: ["Bright[Skyrim].ini"] })],
      // The game's own INI is always applied, and a readme is no edit, so neither is offered.
      ["Bright[Skyrim].ini", "Dark [SkyrimPrefs].ini", "Skyrim.ini", "readme.txt"],
    );

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current).toMatchObject([
      { kind: "switch", id: "iniTweak:Bright[Skyrim].ini", label: "Bright", checked: true },
      { kind: "switch", id: "iniTweak:Dark [SkyrimPrefs].ini", label: "Dark", checked: false },
    ]);
  });

  it("turns one on, marking that the mods need deploying", async () => {
    const { result, dispatch } = renderTweaks([mod()], ["Dark[Skyrim].ini"]);
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => {
      const [dark] = result.current;
      if (dark.kind === "switch") {
        dark.onChange(true);
      }
    });

    expect(dispatch.mock.calls.map(([action]) => action)).toMatchObject([
      {
        type: "SET_TWEAK_ENABLED",
        payload: { gameId: "game", modId: "a", tweak: "Dark[Skyrim].ini", enabled: true },
      },
      { type: "SET_NEED_DEPLOYMENT", payload: { gameId: "game", required: true } },
    ]);
  });

  it("has none for a mod without the folder, several mods, or one not installed", async () => {
    const without = renderTweaks([mod()]).result;
    const several = renderTweaks([mod(), mod({ id: "b" })], ["Dark[Skyrim].ini"]).result;
    const downloaded = renderTweaks([mod({ state: "downloaded" })], ["Dark[Skyrim].ini"]).result;

    // Given the time a listing takes: only the first starts one, of a folder that isn't there,
    // and it lands within act so its update is flushed, not left to warn.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(without.current).toEqual([]);
    expect(several.current).toEqual([]);
    expect(downloaded.current).toEqual([]);
  });
});
