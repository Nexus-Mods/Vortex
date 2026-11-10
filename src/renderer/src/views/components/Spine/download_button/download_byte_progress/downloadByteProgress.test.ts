import { describe, expect, it } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import { makeDownload, makeModInstallInfo, makeRule, makeSession } from "@/test-utils/builders";
import type {
  CollectionModStatus,
  ICollectionInstallSession,
} from "@/types/collections/ICollectionInstallSession";

import { downloadByteProgress } from "./downloadByteProgress";

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

    expect(downloadByteProgress(files, undefined)).toEqual({ received: 50, total: 200 });
  });

  it("counts a downloaded, installing or installed member as fully done", () => {
    const session = sessionWith([
      { tag: "a", status: "downloaded", fileSize: 100 },
      { tag: "b", status: "installing", fileSize: 100 },
      { tag: "c", status: "installed", fileSize: 100 },
    ]);

    expect(downloadByteProgress({}, session)).toEqual({ received: 300, total: 300 });
  });

  it("counts a downloading member's received bytes, paired by tag", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = { dl: memberDownload("a", { size: 100, received: 30 }) };

    expect(downloadByteProgress(files, session)).toEqual({ received: 30, total: 100 });
  });

  it("pairs a download carrying only the legacy referenceTag", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = {
      dl: makeDownload({ modInfo: { referenceTag: "a" }, size: 100, received: 30 }),
    };

    expect(downloadByteProgress(files, session)).toEqual({ received: 30, total: 100 });
  });

  it("keeps rising as one member finishes and the next starts", () => {
    const before = downloadByteProgress(
      { dl1: memberDownload("m1", { size: 100, received: 50 }) },
      sessionWith([
        { tag: "m1", status: "downloading", fileSize: 100 },
        { tag: "m2", status: "pending", fileSize: 100 },
      ]),
    );
    const after = downloadByteProgress(
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

    expect(downloadByteProgress({}, session)).toEqual({ received: 100, total: 100 });
  });

  it("leaves out a member whose download failed while the session still says downloading", () => {
    const session = sessionWith([
      { tag: "a", status: "installed", fileSize: 100 },
      { tag: "b", status: "downloading", fileSize: 100 },
    ]);
    const files = { dl: memberDownload("b", { state: "failed", size: 100, received: 20 }) };

    expect(downloadByteProgress(files, session)).toEqual({ received: 100, total: 100 });
  });

  it("uses the download's size when the rule has no fileSize, and skips a member with neither", () => {
    const session = sessionWith([
      { tag: "a", status: "downloading" },
      { tag: "b", status: "pending" },
    ]);
    const files = { dl: memberDownload("a", { size: 80, received: 20 }) };

    expect(downloadByteProgress(files, session)).toEqual({ received: 20, total: 80 });
  });

  it("uses the largest of fileSize, size and received", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = { dl: memberDownload("a", { size: 0, received: 120 }) };

    expect(downloadByteProgress(files, session)).toEqual({ received: 120, total: 120 });
  });

  it("adds a download outside the collection on top, without counting a member's download twice", () => {
    const session = sessionWith([{ tag: "a", status: "downloading", fileSize: 100 }]);
    const files = {
      member: memberDownload("a", { size: 100, received: 50 }),
      other: makeDownload({ state: "started", size: 300, received: 100 }),
    };

    expect(downloadByteProgress(files, session)).toEqual({ received: 150, total: 400 });
  });
});
