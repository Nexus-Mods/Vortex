import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startActivity, stopActivity } from "@/actions/session";
import { UserCanceled } from "@/util/CustomErrors";

const { api, results } = vi.hoisted(() => ({
  api: {
    getState: vi.fn(() => ({ settings: { automation: { install: false } } })),
    store: { dispatch: vi.fn() },
    events: { emit: vi.fn() },
  },
  // what each archive's install calls back with, by archive id
  results: {} as { [archiveId: string]: [Error | null, string?] },
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));

import { useInstallMods } from "./useInstallMods.hook";

const install = (archiveIds: string[], onEnable = vi.fn()) => {
  const run = renderHook(() => useInstallMods(onEnable)).result.current;
  return run(archiveIds).then(() => onEnable);
};

describe("useInstallMods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.events.emit.mockImplementation((_event, archiveId: string, _options, cb) =>
      cb(...(results[archiveId] ?? [null, `mod-${archiveId}`])),
    );
  });

  it("installs each archive without enabling it, as the legacy table did", async () => {
    await install(["a", "b"]);

    expect(api.events.emit).toHaveBeenCalledWith(
      "start-install-download",
      "a",
      { allowAutoEnable: false },
      expect.any(Function),
    );
    expect(api.events.emit).toHaveBeenCalledWith(
      "start-install-download",
      "b",
      { allowAutoEnable: false },
      expect.any(Function),
    );
  });

  it("lists each archive as installing until its install ends, cancelled or not", async () => {
    results.b = [new UserCanceled()];

    await install(["a", "b"]);

    const dispatched = api.store.dispatch.mock.calls.map(([action]) => action);
    expect(dispatched).toEqual(
      expect.arrayContaining([
        startActivity("mods-installing", "a"),
        stopActivity("mods-installing", "a"),
        startActivity("mods-installing", "b"),
        stopActivity("mods-installing", "b"),
      ]),
    );
    delete results.b;
  });

  it("enables what it installed when the user has Vortex do that", async () => {
    api.getState.mockReturnValueOnce({ settings: { automation: { install: true } } });
    results.b = [new UserCanceled()];

    const onEnable = await install(["a", "b"]);

    expect(onEnable).toHaveBeenCalledWith(["mod-a"]);
    delete results.b;
  });

  it("leaves what it installed alone otherwise", async () => {
    const onEnable = await install(["a"]);

    expect(onEnable).not.toHaveBeenCalled();
  });
});
