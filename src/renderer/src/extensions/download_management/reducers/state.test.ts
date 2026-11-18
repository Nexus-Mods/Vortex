import * as _ from "lodash";
import { describe, it, expect, vi } from "vitest";

import { makeDownload } from "../../../test-utils/builders";
import type { IStateDownloads } from "../../../types/IState";
import * as actions from "../actions/state";
import type { IDownload } from "../types/IDownload";
import { stateReducer } from "./state";

vi.mock("../../../util/errorHandling", () => ({
  terminate: vi.fn(),
}));

import { terminate } from "../../../util/errorHandling";

const base: IStateDownloads = { speed: 0, speedHistory: [], files: {}, checkpoints: {} };

const withFiles = (files: Record<string, IDownload>): IStateDownloads => ({ ...base, files });

describe("addLocalDownload", () => {
  it("adds the download", () => {
    const input = withFiles({});
    const result = stateReducer.reducers.ADD_LOCAL_DOWNLOAD(
      input,
      actions.addLocalDownload("newid", "game", "localPath", 42).payload,
    );

    _.unset(result, ["files", "newid", "fileTime"]);
    expect(result).toEqual({
      ...base,
      files: {
        newid: {
          state: "finished",
          game: ["game"],
          localPath: "localPath",
          size: 42,
          received: 42,
          urls: [],
          modInfo: {},
        },
      },
    });
  });
});

describe("downloadProgress", () => {
  it("updates the progress", () => {
    const input = withFiles({ id: makeDownload({ state: "started", received: 0, size: 43 }) });
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(
      input,
      actions.downloadProgress("id", 42, 43, undefined).payload,
    );
    expect(result).toEqual(
      withFiles({ id: makeDownload({ state: "started", received: 42, size: 43 }) }),
    );
  });
  it("preserves the stored source urls when the payload carries none", () => {
    // restart-on-resume re-resolves from urls[0]; a progress tick must not wipe it
    const input = withFiles({
      id: makeDownload({ state: "started", received: 0, size: 43, urls: ["nxm://game/mods/1"] }),
    });
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(
      input,
      actions.downloadProgress("id", 42, 43, undefined).payload,
    );
    expect(result.files.id.urls).toEqual(["nxm://game/mods/1"]);
  });
  it("replaces the stored source urls when the payload carries some", () => {
    const input = withFiles({
      id: makeDownload({ state: "started", received: 0, size: 43, urls: ["https://old"] }),
    });
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(
      input,
      actions.downloadProgress("id", 42, 43, ["https://redirected"]).payload,
    );
    expect(result.files.id.urls).toEqual(["https://redirected"]);
  });
  it("updates the total", () => {
    const input = withFiles({ id: makeDownload({ state: "started", received: 0, size: 0 }) });
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(
      input,
      actions.downloadProgress("id", 0, 43, undefined).payload,
    );
    expect(result).toEqual(
      withFiles({ id: makeDownload({ state: "started", received: 0, size: 43 }) }),
    );
  });
  it("sets the state to started", () => {
    const input = withFiles({ id: makeDownload({ state: "init", received: 0, size: 43 }) });
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(
      input,
      actions.downloadProgress("id", 1, 43, undefined).payload,
    );
    expect(result).toEqual(
      withFiles({ id: makeDownload({ state: "started", received: 1, size: 43 }) }),
    );
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ someid: makeDownload({ state: "init", received: 0, size: 50 }) });
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(
      input,
      actions.downloadProgress("id", 0, 43, undefined).payload,
    );
    expect(result).toBe(input);
  });
});

describe("finishDownload", () => {
  it("finishes a download", () => {
    const input = withFiles({ id: makeDownload({ state: "started" }) });
    const result = stateReducer.reducers.FINISH_DOWNLOAD(
      input,
      actions.finishDownload("id", "finished", undefined).payload,
    );
    _.unset(result, ["files", "id", "fileTime"]);
    const { fileTime: _fileTime, ...rest } = makeDownload({ state: "finished" });
    expect(result).toEqual({
      ...base,
      files: { id: { ...rest, failCause: undefined } },
    });
  });
  it("stores failure reason", () => {
    const input = withFiles({ id: makeDownload({ state: "started" }) });
    const result = stateReducer.reducers.FINISH_DOWNLOAD(
      input,
      actions.finishDownload("id", "failed", "because error").payload,
    );
    _.unset(result, ["files", "id", "fileTime"]);
    const { fileTime: _fileTime, ...rest } = makeDownload({ state: "failed" });
    expect(result).toEqual({
      ...base,
      files: {
        id: { ...rest, failCause: "because error" },
      },
    });
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ id: makeDownload({ state: "started" }) });
    const result = stateReducer.reducers.FINISH_DOWNLOAD(
      input,
      actions.finishDownload("differentid", "finished", undefined).payload,
    );
    expect(result).toEqual(withFiles({ id: makeDownload({ state: "started" }) }));
  });
});

describe("initDownload", () => {
  it("initialises a download", () => {
    const input = withFiles({});
    const result = stateReducer.reducers.INIT_DOWNLOAD(
      input,
      actions.initDownload("id", ["url1", "url2"], { key: "value" }, ["game"]).payload,
    );
    _.unset(result, ["files", "id", "fileTime"]);
    expect(result).toEqual({
      ...base,
      files: {
        id: {
          id: "id",
          state: "init",
          urls: ["url1", "url2"],
          modInfo: { key: "value" },
          game: ["game"],
        },
      },
    });
  });
  it("terminates if the id exists", () => {
    const input = withFiles({ id: makeDownload({ id: "id", state: "started" }) });
    stateReducer.reducers.INIT_DOWNLOAD(
      input,
      actions.initDownload("id", ["url1", "url2"], { key: "value" }, ["game"]).payload,
    );
    expect(vi.mocked(terminate).mock.calls.length).toEqual(1);
  });
});

describe("pauseDownload", () => {
  it("pauses a running download", () => {
    const input = withFiles({ id: makeDownload({ state: "started", received: 1, size: 2 }) });
    const result = stateReducer.reducers.PAUSE_DOWNLOAD(
      input,
      actions.pauseDownload("id", true).payload,
    );
    expect(result).toEqual(
      withFiles({
        id: makeDownload({ state: "paused", received: 1, size: 2, pauseCount: 1 }),
      }),
    );
  });
  it("increments pauseCount on each pause", () => {
    const input = withFiles({
      id: makeDownload({ state: "started", received: 1, size: 2, pauseCount: 2 }),
    });
    const result = stateReducer.reducers.PAUSE_DOWNLOAD(
      input,
      actions.pauseDownload("id", true).payload,
    );
    expect(result).toEqual(
      withFiles({
        id: makeDownload({ state: "paused", received: 1, size: 2, pauseCount: 3 }),
      }),
    );
  });
  it("resumes a paused download", () => {
    const input = withFiles({ id: makeDownload({ state: "paused", received: 1, size: 2 }) });
    const result = stateReducer.reducers.PAUSE_DOWNLOAD(
      input,
      actions.pauseDownload("id", false).payload,
    );
    expect(result).toEqual(
      withFiles({ id: makeDownload({ state: "started", received: 1, size: 2 }) }),
    );
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ id: makeDownload({ state: "started", received: 1, size: 2 }) });
    const result = stateReducer.reducers.PAUSE_DOWNLOAD(
      input,
      actions.pauseDownload("differentid", true).payload,
    );
    expect(result).toBe(input);
  });
  it("does nothing if the previous state is final", () => {
    const inputFinished = withFiles({
      id: makeDownload({ state: "finished", received: 1, size: 2 }),
    });
    const resultFinished = stateReducer.reducers.PAUSE_DOWNLOAD(
      inputFinished,
      actions.pauseDownload("id", true).payload,
    );
    expect(resultFinished).toBe(inputFinished);
    const inputFailed = withFiles({
      id: makeDownload({ state: "failed", received: 1, size: 2 }),
    });
    const resultFailed = stateReducer.reducers.PAUSE_DOWNLOAD(
      inputFailed,
      actions.pauseDownload("id", true).payload,
    );
    expect(resultFailed).toBe(inputFailed);
  });
});

describe("removeDownload", () => {
  it("removes the download", () => {
    const input = withFiles({ id: makeDownload({ state: "finished" }) });
    const result = stateReducer.reducers.REMOVE_DOWNLOAD(
      input,
      actions.removeDownload("id").payload,
    );
    expect(result).toEqual(withFiles({}));
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ id: makeDownload({ state: "finished" }) });
    const result = stateReducer.reducers.REMOVE_DOWNLOAD(
      input,
      actions.removeDownload("differentid").payload,
    );
    expect(result).toBe(input);
  });
});

describe("setDownloadFilepath", () => {
  it("changes the download path", () => {
    const input = withFiles({ id: makeDownload({ state: "started", localPath: "oldpath" }) });
    const result = stateReducer.reducers.SET_DOWNLOAD_FILEPATH(
      input,
      actions.setDownloadFilePath("id", "newpath").payload,
    );
    expect(result).toEqual(
      withFiles({ id: makeDownload({ state: "started", localPath: "newpath" }) }),
    );
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ id: makeDownload({ state: "finished", localPath: "oldpath" }) });
    const result = stateReducer.reducers.SET_DOWNLOAD_FILEPATH(
      input,
      actions.setDownloadFilePath("differentid", "newpath").payload,
    );
    expect(result).toBe(input);
  });
});

describe("setDownloadHash", () => {
  it("changes the file hash", () => {
    const input = withFiles({ id: makeDownload({ state: "finished", fileMD5: "oldhash" }) });
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH(
      input,
      actions.setDownloadHash("id", "newhash").payload,
    );
    expect(result).toEqual(
      withFiles({ id: makeDownload({ state: "finished", fileMD5: "newhash" }) }),
    );
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ id: makeDownload({ state: "finished", fileMD5: "oldhash" }) });
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH(
      input,
      actions.setDownloadHash("differentid", "newhash").payload,
    );
    expect(result).toBe(input);
  });
});

describe("setDownloadHashByFile", () => {
  it("changes the file hash and size", () => {
    const input = withFiles({
      id: makeDownload({ state: "finished", localPath: "path", fileMD5: "oldhash", size: 1 }),
    });
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH_BY_FILE(
      input,
      actions.setDownloadHashByFile("path", "newhash", 42).payload,
    );
    expect(result).toEqual(
      withFiles({
        id: makeDownload({ state: "finished", localPath: "path", fileMD5: "newhash", size: 42 }),
      }),
    );
  });
  it("does nothing if the name is unknown", () => {
    const input = withFiles({
      id: makeDownload({ state: "finished", localPath: "path", fileMD5: "oldhash" }),
    });
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH_BY_FILE(
      input,
      actions.setDownloadHashByFile("wrongpath", "newhash", 42).payload,
    );
    expect(result).toBe(input);
  });
});

describe("startDownload", () => {
  it("sets the download state as started", () => {
    const input = withFiles({ id: makeDownload({ state: "init" }) });
    const result = stateReducer.reducers.START_DOWNLOAD(input, actions.startDownload("id").payload);
    expect(result.files.id.state).toEqual("started");
  });
  it("does nothing if the download is already finished", () => {
    const input = withFiles({ id: makeDownload({ state: "finished" }) });
    const result = stateReducer.reducers.START_DOWNLOAD(input, actions.startDownload("id").payload);
    expect(result).toBe(input);
  });
  it("does nothing if the download is paused", () => {
    const input = withFiles({ id: makeDownload({ state: "paused" }) });
    const result = stateReducer.reducers.START_DOWNLOAD(input, actions.startDownload("id").payload);
    expect(result).toBe(input);
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ id: makeDownload({ state: "paused" }) });
    const result = stateReducer.reducers.START_DOWNLOAD(
      input,
      actions.startDownload("differentid").payload,
    );
    _.unset(result, ["startTime"]);
    expect(result).toEqual(input);
  });
});

describe("setDownloadSpeed", () => {
  it("sets the download speed", () => {
    const input = { ...base, speed: 0 };
    const result = stateReducer.reducers.SET_DOWNLOAD_SPEED(
      input,
      actions.setDownloadSpeed(42).payload,
    );
    expect(result.speed).toEqual(42);
  });
});

describe("setDownloadSpeeds", () => {
  it("stores the speed history and last speed", () => {
    const input = { ...base, speed: 0, speedHistory: [] };
    const result = stateReducer.reducers.SET_DOWNLOAD_SPEEDS(
      input,
      actions.setDownloadSpeeds([1, 2, 3]).payload,
    );
    expect(result.speedHistory).toEqual([1, 2, 3]);
    expect(result.speed).toEqual(3);
  });
  it("trims to the last NUM_SPEED_DATA_POINTS entries", () => {
    const input = { ...base, speed: 0, speedHistory: [] };
    const payload = Array.from({ length: 50 }, (_unused, idx) => idx);
    const result = stateReducer.reducers.SET_DOWNLOAD_SPEEDS(
      input,
      actions.setDownloadSpeeds(payload).payload,
    );
    expect(result.speedHistory.length).toEqual(30);
    expect(result.speedHistory[0]).toEqual(20);
    expect(result.speed).toEqual(49);
  });
  it("normalizes a non-array payload to an empty history", () => {
    // persisted or extension-dispatched payloads aren't type checked, so the reducer guards
    const input = { ...base, speed: 5, speedHistory: [1, 2] };
    const result = stateReducer.reducers.SET_DOWNLOAD_SPEEDS(input, { foo: "bar" });
    expect(result.speedHistory).toEqual([]);
    expect(result.speed).toEqual(0);
  });
});

describe("setDownloadModInfo", () => {
  it("sets a dotted key, creating missing levels and keeping the others", () => {
    const input = withFiles({
      id: makeDownload({ modInfo: { name: "mod", nexus: { ids: { modId: 1 } } } }),
    });
    const result = stateReducer.reducers.SET_DOWNLOAD_MODINFO(
      input,
      actions.setDownloadModInfo("id", "nexus.ids.fileId", 2).payload,
    );
    expect(result).toEqual(
      withFiles({
        id: makeDownload({ modInfo: { name: "mod", nexus: { ids: { modId: 1, fileId: 2 } } } }),
      }),
    );
    // the stored modInfo is copied, not changed in place
    expect(input.files.id.modInfo).toEqual({ name: "mod", nexus: { ids: { modId: 1 } } });
  });
  it("creates the path when modInfo has none of it", () => {
    const input = withFiles({ id: makeDownload({ modInfo: {} }) });
    const result = stateReducer.reducers.SET_DOWNLOAD_MODINFO(
      input,
      actions.setDownloadModInfo("id", "meta.details.author", "someone").payload,
    );
    expect(result.files.id.modInfo).toEqual({ meta: { details: { author: "someone" } } });
  });
  it("keeps an array level an array", () => {
    const input = withFiles({ id: makeDownload({ modInfo: { referenceTags: ["a", "b"] } }) });
    const result = stateReducer.reducers.SET_DOWNLOAD_MODINFO(
      input,
      actions.setDownloadModInfo("id", "referenceTags.1", "c").payload,
    );
    expect(result.files.id.modInfo.referenceTags).toEqual(["a", "c"]);
  });
  it("does nothing if the id is unknown", () => {
    const input = withFiles({ id: makeDownload() });
    const result = stateReducer.reducers.SET_DOWNLOAD_MODINFO(
      input,
      actions.setDownloadModInfo("differentid", "name", "mod").payload,
    );
    expect(result).toBe(input);
  });
});
