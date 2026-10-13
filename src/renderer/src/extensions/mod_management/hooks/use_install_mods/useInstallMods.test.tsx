import { renderHook } from "@testing-library/react";
import { VortexError } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startActivity, stopActivity } from "@/actions/session";

const READY = { state: "finished", localPath: "archive.7z" };

// The user's automation settings, and each archive's download, ready to install unless a
// test says otherwise.
const stateWith = (enable = false, files: object = { a: READY, b: READY }, install = false) => ({
  settings: { automation: { enable, install } },
  persistent: { downloads: { files } },
});

const { api, results } = vi.hoisted(() => ({
  api: {
    getState: vi.fn(),
    store: { dispatch: vi.fn() },
    events: { emit: vi.fn() },
    showErrorNotification: vi.fn(),
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
    api.getState.mockReturnValue(stateWith());
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
    results.b = [new VortexError("canceled by user", { kind: "user-canceled", skipped: false })];

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

  it("enables what it installed when the user has Vortex enable mods when installed", async () => {
    api.getState.mockReturnValue(stateWith(true));
    results.b = [new VortexError("canceled by user", { kind: "user-canceled", skipped: false })];

    const onEnable = await install(["a", "b"]);

    expect(onEnable).toHaveBeenCalledWith(["mod-a"]);
    delete results.b;
  });

  it("follows Enable Mods when installed, not Install Mods when downloaded", async () => {
    api.getState.mockReturnValue(stateWith(false, undefined, true));

    const onEnable = await install(["a"]);

    expect(onEnable).not.toHaveBeenCalled();
  });

  it.each([
    ["one Vortex no longer knows about", {}],
    ["an unfinished download", { a: { state: "started", localPath: "archive.7z" } }],
    ["a download without its path", { a: { state: "finished" } }],
  ])("says why it can't install %s, without starting or hanging", async (_case, files) => {
    api.getState.mockReturnValue(stateWith(false, files));

    await install(["a"]);

    expect(api.events.emit).not.toHaveBeenCalled();
    expect(api.showErrorNotification).toHaveBeenCalledWith(
      "Failed to install mod",
      expect.any(String),
      { allowReport: false },
    );
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity("mods-installing", "a"));
  });

  it("says why the handler wouldn't start an install, which it only passes on", async () => {
    results.a = [new VortexError("Download file not accessible", { kind: "data-invalid" })];

    await install(["a"]);

    expect(api.showErrorNotification).toHaveBeenCalledWith(
      "Failed to install mod",
      expect.any(VortexError),
      { allowReport: false },
    );
    delete results.a;
  });

  it("leaves a cancel, and a failure the install reports itself, unsaid", async () => {
    results.a = [new VortexError("canceled by user", { kind: "user-canceled", skipped: false })];
    results.b = [new Error("installer failed")];

    await install(["a", "b"]);

    expect(api.showErrorNotification).not.toHaveBeenCalled();
    delete results.a;
    delete results.b;
  });

  it("leaves what it installed alone otherwise", async () => {
    const onEnable = await install(["a"]);

    expect(onEnable).not.toHaveBeenCalled();
  });
});
