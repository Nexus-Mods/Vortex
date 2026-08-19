/**
 * Appending a collection-rule tag to a download's tag set. One archive can satisfy rules in
 * several collections, so the set only ever grows: the legacy single field keeps the first tag
 * (older Vortex versions read only that one) and every tag lands in the array.
 */
import { describe, expect, it } from "vitest";

import { makeDownload } from "../../../test-utils/builders";
import type { IDownload } from "../../download_management/types/IDownload";
import { downloadReferenceTags } from "../../mod_management/util/testModReference";
import { stateReducer } from "../reducers/state";
import { appendReferenceTagActions } from "./referenceTags";

// run the produced actions through the real download reducer, so what is asserted is the modInfo a
// download ends up with rather than the shape of the actions
const applied = (download: IDownload, tag: string) => {
  const actions = appendReferenceTagActions("dl-1", download, tag);
  // keyed by download id, as the download slice is
  let files: Record<string, IDownload> = { "dl-1": download };
  for (const action of actions) {
    const reduce = stateReducer.reducers[action.type];
    files = reduce({ files }, (action as unknown as { payload: unknown }).payload).files;
  }
  return { actions, modInfo: files["dl-1"].modInfo };
};

describe("appendReferenceTagActions", () => {
  it("records the tag in the array and as the first tag", () => {
    const { modInfo } = applied(makeDownload({ modInfo: {} }), "tag-a");

    expect(modInfo.referenceTag).toBe("tag-a");
    expect(modInfo.referenceTags).toEqual(["tag-a"]);
  });

  it("keeps the first tag when a second collection's tag is added", () => {
    const { modInfo } = applied(
      makeDownload({ modInfo: { referenceTag: "tag-a", referenceTags: ["tag-a"] } }),
      "tag-b",
    );

    expect(modInfo.referenceTag).toBe("tag-a");
    expect(modInfo.referenceTags).toEqual(["tag-a", "tag-b"]);
  });

  it("adopts a download that carries only the legacy single tag", () => {
    const { modInfo } = applied(makeDownload({ modInfo: { referenceTag: "legacy" } }), "tag-b");

    expect(modInfo.referenceTag).toBe("legacy");
    expect(modInfo.referenceTags).toEqual(["legacy", "tag-b"]);
  });

  it("produces no actions for a tag the download already carries", () => {
    const legacyOnly = makeDownload({ modInfo: { referenceTag: "tag-a" } });
    expect(appendReferenceTagActions("dl-1", legacyOnly, "tag-a")).toEqual([]);

    const inArray = makeDownload({ modInfo: { referenceTags: ["tag-a", "tag-b"] } });
    expect(appendReferenceTagActions("dl-1", inArray, "tag-b")).toEqual([]);
  });
});

describe("downloadReferenceTags", () => {
  it("reads the legacy tag and the array as one deduped set", () => {
    expect(
      downloadReferenceTags(
        makeDownload({ modInfo: { referenceTag: "tag-a", referenceTags: ["tag-a", "tag-b"] } }),
      ),
    ).toEqual(["tag-a", "tag-b"]);
  });

  it("reads a download that carries only the legacy tag", () => {
    expect(downloadReferenceTags(makeDownload({ modInfo: { referenceTag: "only" } }))).toEqual([
      "only",
    ]);
  });

  it("reads an untagged or missing download as carrying no tags", () => {
    expect(downloadReferenceTags(makeDownload({ modInfo: {} }))).toEqual([]);
    expect(downloadReferenceTags(undefined)).toEqual([]);
  });
});
