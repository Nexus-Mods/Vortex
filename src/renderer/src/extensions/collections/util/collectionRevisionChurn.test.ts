/**
 * Driver-level churn for collection revision update/downgrade. A real collection runs into the
 * thousands of members and a user updates/downgrades repeatedly, so each test churns the real
 * InstallDriver through a sequence of revisions over a large shared member core: start on a
 * revision (re-attributing against what is on disk), let it complete through review and close the
 * session, then move on - the way an actual update follows a finished install.
 */
import { describe, expect } from "vitest";

import { makeRevision } from "../../../test-utils/builders";
import { test } from "../../../test-utils/collectionTest";
import type { IRevisionMemberSpec } from "../../../test-utils/harnessTypes";

// thousands of members, matching the scale the field reports showed; overridable for stress runs
const CORE_COUNT = Number(process.env.COLLECTION_CHURN_MEMBERS) || 2000;
const core: IRevisionMemberSpec[] = Array.from({ length: CORE_COUNT }, (_, i) => ({
  tag: `m${i}`,
}));

// a revision of ONE collection (shared collection id): the large shared core plus a small
// per-revision delta of added/updated members
const revisionAt = (revisionNumber: number, delta: IRevisionMemberSpec[]) =>
  makeRevision(revisionNumber, [...core, ...delta], { collectionId: "col-1" });

describe("collection revision churn (repeated update/downgrade at scale)", () => {
  test("re-attributes the shared core across several updates and downgrades", async ({
    makeCollection,
  }) => {
    const rev1 = revisionAt(1, [{ tag: "a1" }, { tag: "a2" }]);
    const rev2 = revisionAt(2, [{ tag: "b1" }, { tag: "b2" }]); // a* dropped, b* added
    const rev3 = revisionAt(3, [{ tag: "c1" }]); // b* dropped, c1 added
    // up, up, then back down - several swaps in a row over the same installed core
    const sequence = [rev1, rev2, rev3, rev2, rev1];

    const collection = makeCollection();
    let onDisk = rev1.installed.slice(0, 0); // nothing installed yet

    for (const rev of sequence) {
      await collection.installRevision(rev, onDisk);

      // a shared-core member is re-attributed from what is already on disk, never re-pulled
      // (it sits "pending" only on the very first revision, when nothing is installed yet)
      expect(collection.memberStatus("m0")).toBe(onDisk.length === 0 ? "pending" : "installed");

      // the install finishes, the driver reaches review, and the session closes
      await collection.completeActiveInstall();
      onDisk = rev.installed;
    }

    // the whole up/down churn left the driver idle with no leaked active session
    expect(collection.getState().session.collections.activeSession).toBeUndefined();
  });

  test("on update, a changed member's new file is pending while the dropped old file is released", async ({
    makeCollection,
  }) => {
    const before = revisionAt(1, [{ tag: "x1" }]);
    const after = revisionAt(2, [{ tag: "x2" }]); // member x updated: its pinned file (tag) changed

    const collection = makeCollection();
    await collection.installRevision(before);
    await collection.completeActiveInstall();

    // upgrade: the new revision's rules, but only the old revision's files are on disk
    await collection.installRevision(after, before.installed);

    expect(collection.memberStatus("m0")).toBe("installed"); // shared core re-attributed
    expect(collection.memberStatus("x2")).toBe("pending"); // updated member's new file not installed
    expect(collection.memberStatus("x1")).toBeUndefined(); // old member is not in the new revision
    expect(collection.driver.isInstallComplete(false)).toBe(false);
  });
});
