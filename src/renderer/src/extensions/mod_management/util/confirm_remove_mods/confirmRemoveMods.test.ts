import { VortexGameId } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startActivity, stopActivity } from "@/actions/session";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { ProcessCanceled, UserCanceled } from "@/util/CustomErrors";

const { removeMods } = vi.hoisted(() => ({ removeMods: vi.fn() }));

vi.mock("../removeMods", () => ({ removeMods }));

import { confirmRemoveMods, REMOVING_ACTIVITY } from "./confirmRemoveMods";

const GAME = VortexGameId("game");

// Installed "a" and "b", "a" from its archive, and "c" still installing; "dl" is an archive
// only downloaded.
const MODS = {
  a: {
    id: "a",
    state: "installed",
    archiveId: "archive-a",
    attributes: { name: "Alpha", version: "1.0" },
  },
  b: { id: "b", state: "installed", attributes: { name: "Beta", version: "2.0" } },
  c: { id: "c", state: "installing", attributes: { name: "Gamma", version: "3.0" } },
};
const DOWNLOADS = {
  "archive-a": { state: "finished", localPath: "alpha.zip" },
  dl: { state: "finished", localPath: "delta.7z" },
  pending: { state: "started", localPath: "pending.zip" },
};

const makeApi = (activity: { [group: string]: string[] } = {}) => {
  const state = {
    persistent: { mods: { [GAME]: MODS }, downloads: { files: DOWNLOADS } },
    session: { base: { activity } },
  };
  const api = {
    getState: () => state,
    store: { dispatch: vi.fn() },
    translate: (key: string) => key,
    showDialog: vi.fn(),
    sendNotification: vi.fn(),
    showErrorNotification: vi.fn(),
    events: { emit: vi.fn() },
  };
  return { api, state };
};

type TestApi = ReturnType<typeof makeApi>["api"];

const remove = (api: TestApi, modIds: string[]) =>
  confirmRemoveMods(api as unknown as IExtensionApi, GAME, modIds);

const confirmWith = (api: TestApi, input: { mod?: boolean; archive?: boolean }) =>
  api.showDialog.mockResolvedValue({ action: "Remove", input });

const dispatched = (api: TestApi) => api.store.dispatch.mock.calls.map(([action]) => action);

// Answers each archive removal as the download manager does once it's gone.
const answerDownloads = (api: TestApi, err: Error | null = null) =>
  api.events.emit.mockImplementation(
    (event: string, _id: string, cb: (e: Error | null) => void) => {
      if (event === "remove-download") {
        cb(err);
      }
    },
  );

describe("confirmRemoveMods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeMods.mockResolvedValue(undefined);
  });

  it("asks with the classic table's dialog and removes the installed mods once confirmed", async () => {
    const { api } = makeApi();
    confirmWith(api, { mod: true, archive: false });

    expect(await remove(api, ["a"])).toBe(true);

    expect(api.showDialog).toHaveBeenCalledWith(
      "question",
      "Confirm removal",
      {
        bbcode: "Do you really want to remove this mod{{insert}}?",
        message: "Alpha (v1.0)",
        checkboxes: [
          { id: "mod", text: "Remove Mod", value: true },
          { id: "archive", text: "Delete Archive", value: false },
        ],
      },
      [{ label: "Cancel" }, { label: "Remove" }],
    );
    expect(removeMods).toHaveBeenCalledWith(api, GAME, ["a"]);
    expect(api.events.emit).not.toHaveBeenCalled();
  });

  it("lists each mod as removing from confirmation until done, even on failure", async () => {
    const { api } = makeApi();
    confirmWith(api, { mod: true });
    let listed: unknown[] = [];
    removeMods.mockImplementation(async () => {
      listed = dispatched(api);
      throw new Error("boom");
    });

    expect(await remove(api, ["a", "b"])).toBe(false);

    expect(listed).toEqual([
      startActivity(REMOVING_ACTIVITY, "a"),
      startActivity(REMOVING_ACTIVITY, "b"),
    ]);
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity(REMOVING_ACTIVITY, "a"));
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity(REMOVING_ACTIVITY, "b"));
    expect(api.showErrorNotification).toHaveBeenCalledWith(
      "Failed to remove mods",
      expect.any(Error),
      { allowReport: true },
    );
  });

  it("marks nothing when the dialog is cancelled", async () => {
    const { api } = makeApi();
    api.showDialog.mockResolvedValue({ action: "Cancel", input: { mod: true } });

    expect(await remove(api, ["a"])).toBe(false);

    expect(removeMods).not.toHaveBeenCalled();
    expect(api.store.dispatch).not.toHaveBeenCalled();
  });

  it("skips mods already being removed or uninstalled", async () => {
    const { api } = makeApi({ [REMOVING_ACTIVITY]: ["a"], "mods-uninstalling": ["dl"] });
    confirmWith(api, { mod: true });

    await remove(api, ["a", "b", "dl"]);

    expect(api.showDialog.mock.calls[0][2].message).toBe("Beta (v2.0)");
    expect(removeMods).toHaveBeenCalledWith(api, GAME, ["b"]);
    expect(dispatched(api)).not.toContainEqual(startActivity(REMOVING_ACTIVITY, "a"));
  });

  it("asks nothing when every mod is already busy, or can't be removed", async () => {
    const { api } = makeApi({ [REMOVING_ACTIVITY]: ["a"] });

    expect(await remove(api, ["a", "c", "pending", "unknown"])).toBe(false);

    expect(api.showDialog).not.toHaveBeenCalled();
  });

  it("does nothing if the mod started being removed while its dialog was open", async () => {
    const { api, state } = makeApi();
    api.showDialog.mockImplementation(async () => {
      state.session.base.activity = { [REMOVING_ACTIVITY]: ["a"] };
      return { action: "Remove", input: { mod: true } };
    });

    expect(await remove(api, ["a"])).toBe(false);

    expect(removeMods).not.toHaveBeenCalled();
    expect(api.store.dispatch).not.toHaveBeenCalled();
  });

  it("deletes the archives when Delete Archive is ticked, and stays removing until each is gone", async () => {
    const { api } = makeApi();
    confirmWith(api, { mod: true, archive: true });
    const callbacks: Array<(err: Error | null) => void> = [];
    api.events.emit.mockImplementation((_event, _id, cb) => void callbacks.push(cb));

    const done = remove(api, ["a", "dl"]);
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));

    expect(api.events.emit).toHaveBeenCalledWith(
      "remove-download",
      "archive-a",
      expect.any(Function),
      {
        confirmed: true,
      },
    );
    expect(api.events.emit).toHaveBeenCalledWith("remove-download", "dl", expect.any(Function), {
      confirmed: true,
    });
    expect(api.store.dispatch).not.toHaveBeenCalledWith(stopActivity(REMOVING_ACTIVITY, "a"));

    callbacks.forEach((cb) => cb(null));

    expect(await done).toBe(true);
    expect(removeMods).toHaveBeenCalledWith(api, GAME, ["a"]);
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity(REMOVING_ACTIVITY, "a"));
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity(REMOVING_ACTIVITY, "dl"));
  });

  it("offers only Delete Archive, ticked, for archive-only rows", async () => {
    const { api } = makeApi();
    confirmWith(api, { archive: true });
    answerDownloads(api);

    expect(await remove(api, ["dl"])).toBe(true);

    expect(api.showDialog.mock.calls[0][2]).toMatchObject({
      message: "delta.7z (Archive only)",
      checkboxes: [{ id: "archive", text: "Delete Archive", value: true }],
    });
    expect(removeMods).not.toHaveBeenCalled();
    expect(api.events.emit).toHaveBeenCalledWith("remove-download", "dl", expect.any(Function), {
      confirmed: true,
    });
  });

  it("reports an archive that couldn't be deleted, and stops listing it as removing", async () => {
    const { api } = makeApi();
    confirmWith(api, { archive: true });
    answerDownloads(api, new Error("locked"));

    expect(await remove(api, ["dl"])).toBe(false);

    expect(api.showErrorNotification).toHaveBeenCalledWith(
      "Failed to remove mods",
      expect.any(Error),
      { allowReport: true },
    );
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity(REMOVING_ACTIVITY, "dl"));
  });

  it("says nothing when the removal is cancelled, and warns when it can't go ahead", async () => {
    const { api } = makeApi();
    confirmWith(api, { mod: true });

    removeMods.mockRejectedValueOnce(new UserCanceled());
    expect(await remove(api, ["a"])).toBe(false);
    expect(api.sendNotification).not.toHaveBeenCalled();

    removeMods.mockRejectedValueOnce(new ProcessCanceled("in use"));
    expect(await remove(api, ["a"])).toBe(false);
    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cant-remove-mod", type: "warning", message: "in use" }),
    );
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });
});
