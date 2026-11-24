import { describe, expect, it } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import { makeDownload, makeModInstallInfo, makeRule, makeSession } from "@/test-utils/builders";
import type {
  CollectionModStatus,
  ICollectionInstallSession,
} from "@/types/collections/ICollectionInstallSession";

import { downloadByteProgress, downloadedMemberIds } from "./downloadByteProgress";

interface IMemberFixture {
  tag: string;
  status: CollectionModStatus;
  fileSize?: number;
  type?: "requires" | "recommends";
}

/** A session whose members are keyed by their tag, which doubles as the rule id. */
const sessionWith = (members: IMemberFixture[]): ICollectionInstallSession =>
  makeSession({
    mods: Object.fromEntries(
      members.map(({ tag, status, fileSize, type = "requires" }) => [
        tag,
        makeModInstallInfo({
          rule: makeRule({ type, reference: { tag, fileSize } }),
          status,
          type,
        }),
      ]),
    ),
  });

/** Just the byte figures, for the tests about what the ring counts. */
const bytes = (...args: Parameters<typeof downloadByteProgress>) => {
  const { received, total } = downloadByteProgress(...args);
  return { received, total };
};

/** A download claimed by the member with this tag, as the collection install stamps it. */
const memberDownload = (tag: string, overrides: Partial<IDownload> = {}): IDownload =>
  makeDownload({ modInfo: { referenceTags: [tag] }, ...overrides });

describe("downloadByteProgress", () => {
  it("matches today's maths with no session", () => {
    const files = {
      active: makeDownload({ state: "started", size: 100, received: 40 }),
      paused: makeDownload({ state: "paused", size: 100, received: 10 }),
      done: makeDownload({ state: "finished", size: 100, received: 100 }),
    };

    expect(bytes(files, undefined)).toEqual({ received: 50, total: 200 });
  });

  it("counts a downloaded, installing or installed member as fully done", () => {
    const session = sessionWith([
      { tag: "a", status: "downloaded", fileSize: 100 },
      { tag: "b", status: "installing", fileSize: 100 },
      { tag: "c", status: "installed", fileSize: 100 },
    ]);

    expect(bytes({}, session)).toEqual({ received: 300, total: 300 });
  });

  it("counts a downloading member's received bytes, paired by tag", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = { dl: memberDownload("a", { size: 100, received: 30 }) };

    expect(bytes(files, session)).toEqual({ received: 30, total: 100 });
  });

  it("pairs a download carrying only the legacy referenceTag", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = {
      dl: makeDownload({ modInfo: { referenceTag: "a" }, size: 100, received: 30 }),
    };

    expect(bytes(files, session)).toEqual({ received: 30, total: 100 });
  });

  it("keeps rising as one member finishes and the next starts", () => {
    const before = bytes(
      { dl1: memberDownload("m1", { size: 100, received: 50 }) },
      sessionWith([
        { tag: "m1", status: "downloading", fileSize: 100 },
        { tag: "m2", status: "pending", fileSize: 100 },
      ]),
    );
    const after = bytes(
      {
        dl1: memberDownload("m1", { state: "finished", size: 100, received: 100 }),
        dl2: memberDownload("m2", { size: 100, received: 0 }),
      },
      sessionWith([
        { tag: "m1", status: "downloaded", fileSize: 100 },
        { tag: "m2", status: "downloading", fileSize: 100 },
      ]),
    );

    expect(before).toEqual({ received: 50, total: 200 });
    expect(after).toEqual({ received: 100, total: 200 });
  });

  it("leaves out failed, ignored and unselected optional members", () => {
    const session = sessionWith([
      { tag: "a", status: "installed", fileSize: 100 },
      { tag: "b", status: "failed", fileSize: 100 },
      { tag: "c", status: "ignored", fileSize: 100, type: "recommends" },
      { tag: "d", status: "optional", fileSize: 100, type: "recommends" },
    ]);

    expect(bytes({}, session)).toEqual({ received: 100, total: 100 });
  });

  it("counts a member whose download failed as done at the bytes it got", () => {
    // The session keeps a failed download's member on "downloading".
    const session = sessionWith([
      { tag: "a", status: "installed", fileSize: 100 },
      { tag: "b", status: "downloading", fileSize: 100 },
    ]);
    const files = { dl: memberDownload("b", { state: "failed", size: 100, received: 20 }) };

    expect(bytes(files, session)).toEqual({ received: 120, total: 120 });
  });

  it("doesn't go backwards when a member's download fails", () => {
    const session = sessionWith([
      { tag: "a", status: "installed", fileSize: 100 },
      { tag: "b", status: "downloading", fileSize: 1000 },
      { tag: "c", status: "pending", fileSize: 1000 },
    ]);
    const progress = (state: "started" | "failed") => {
      const { received, total } = bytes(
        { dl: memberDownload("b", { state, size: 1000, received: 900 }) },
        session,
      );
      return received / total;
    };

    expect(progress("failed")).toBeGreaterThanOrEqual(progress("started"));
  });

  it("counts an archive that satisfies several members once", () => {
    const session = sessionWith([
      { tag: "a", status: "downloading", fileSize: 100 },
      { tag: "b", status: "downloading", fileSize: 100 },
    ]);
    const files = {
      dl: makeDownload({ modInfo: { referenceTags: ["a", "b"] }, size: 100, received: 30 }),
    };

    expect(bytes(files, session)).toEqual({ received: 30, total: 100 });
  });

  it("uses the download's size when the rule has no fileSize, and skips a member with neither", () => {
    const session = sessionWith([
      { tag: "a", status: "downloading" },
      { tag: "b", status: "pending" },
    ]);
    const files = { dl: memberDownload("a", { size: 80, received: 20 }) };

    expect(bytes(files, session)).toEqual({ received: 20, total: 80 });
  });

  it("uses the largest of fileSize, size and received", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = { dl: memberDownload("a", { size: 0, received: 120 }) };

    expect(bytes(files, session)).toEqual({ received: 120, total: 120 });
  });

  it("adds a download outside the collection on top, without counting a member's download twice", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = {
      member: memberDownload("a", { size: 100, received: 50 }),
      other: makeDownload({ state: "started", size: 300, received: 100 }),
    };

    expect(bytes(files, session)).toEqual({ received: 150, total: 400 });
  });

  it("leaves out members that were already downloaded when the install started", () => {
    const session = sessionWith([
      { tag: "a", status: "installed", fileSize: 1000 },
      { tag: "b", status: "downloading", fileSize: 100 },
    ]);
    const files = { dl: memberDownload("b", { size: 100, received: 50 }) };

    expect(bytes(files, session, new Set(["a"]))).toEqual({
      received: 50,
      total: 100,
    });
  });

  it("pairs a member with its retried download over an earlier failed one", () => {
    const session = sessionWith([
      { tag: "a", status: "installed", fileSize: 100 },
      { tag: "b", status: "pending", fileSize: 100 },
    ]);
    const files = {
      first: memberDownload("a", { state: "failed", size: 100, received: 20 }),
      retry: memberDownload("a", { state: "finished", size: 100, received: 100 }),
    };

    expect(bytes(files, session)).toEqual({ received: 100, total: 200 });
  });

  it("counts an excluded member's still-running download as an unrelated one", () => {
    const session = sessionWith([{ tag: "a", status: "failed", fileSize: 100 }]);
    const files = { dl: memberDownload("a", { state: "started", size: 100, received: 20 }) };

    expect(bytes(files, session)).toEqual({ received: 20, total: 100 });
  });

  it("names the active downloads and the paused ones, whatever the session", () => {
    const files = {
      init: makeDownload({ state: "init" }),
      started: makeDownload({ state: "started" }),
      finalizing: makeDownload({ state: "finalizing" }),
      paused: makeDownload({ state: "paused" }),
      done: makeDownload({ state: "finished" }),
      failed: makeDownload({ state: "failed" }),
    };
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);

    for (const s of [undefined, session]) {
      const { activeIds, pausedIds } = downloadByteProgress(files, s);
      expect(activeIds).toEqual(["init", "started", "finalizing"]);
      expect(pausedIds).toEqual(["paused"]);
    }
  });
});

describe("downloadedMemberIds", () => {
  it("names the members whose archive is already on disk", () => {
    const session = sessionWith([
      { tag: "a", status: "downloaded" },
      { tag: "b", status: "installing" },
      { tag: "c", status: "installed" },
      { tag: "d", status: "pending" },
      { tag: "e", status: "downloading" },
      { tag: "f", status: "failed" },
    ]);

    expect([...downloadedMemberIds(session)].sort()).toEqual(["a", "b", "c"]);
  });
});
