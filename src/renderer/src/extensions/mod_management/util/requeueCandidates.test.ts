/**
 * selectRequeueCandidates - the pure decision behind InstallManager's requeue pass.
 *
 * The phase bound carries the weight: optionals sit at the trailing OPTIONAL_PHASE, so they must not
 * be requeued while a required phase runs, and must be requeued once the gate reaches it. The second
 * half is regression cover for LAZ-843.
 */
import { describe, expect, it } from "vitest";

import { makeModInstallInfo, makeReference, makeRule } from "../../../test-utils/builders";
import type {
  CollectionModStatus,
  ICollectionModInstallInfo,
} from "../../../types/collections/ICollectionInstallSession";
import { selectRequeueCandidates } from "./requeueCandidates";
import { OPTIONAL_PHASE } from "./rulePhase";

const requiredMember = makeModInstallInfo({
  rule: makeRule({ type: "requires", reference: makeReference({ tag: "req-a" }) }),
  type: "requires",
  status: "downloaded",
  phase: 0,
});

const optionalMember = makeModInstallInfo({
  rule: makeRule({ type: "recommends", reference: makeReference({ tag: "opt-a" }) }),
  type: "recommends",
  status: "downloaded",
  phase: OPTIONAL_PHASE,
});

// every member's archive resolves to a download, so the phase/status filters are what decide
const allResolve = () => "dl-1";
const tagsOf = (members: ICollectionModInstallInfo[], phase: number) =>
  selectRequeueCandidates(members, phase, allResolve).map((c) => c.rule.reference.tag);

describe("selectRequeueCandidates", () => {
  it("selects a downloaded member at or before the phase being processed", () => {
    expect(tagsOf([requiredMember], 0)).toEqual(["req-a"]);
    expect(tagsOf([requiredMember], 2)).toEqual(["req-a"]);
  });

  it("holds an optional back while a required phase is still being processed", () => {
    // OPTIONAL_PHASE (666) > 0, so the optional must not overtake the required members
    expect(tagsOf([requiredMember, optionalMember], 0)).toEqual(["req-a"]);
  });

  it("selects a downloaded optional once the gate reaches OPTIONAL_PHASE (LAZ-843)", () => {
    expect(tagsOf([requiredMember, optionalMember], OPTIONAL_PHASE)).toEqual(["req-a", "opt-a"]);
  });

  it("skips members that are not at 'downloaded'", () => {
    const statuses: CollectionModStatus[] = [
      "pending",
      "downloading",
      "installing",
      "installed",
      "failed",
      "ignored",
    ];
    for (const status of statuses) {
      expect(tagsOf([{ ...optionalMember, status }], OPTIONAL_PHASE)).toEqual([]);
    }
  });

  it("skips a member whose download cannot be resolved", () => {
    expect(selectRequeueCandidates([optionalMember], OPTIONAL_PHASE, () => null)).toEqual([]);
  });

  it("attaches the resolved downloadId to each candidate", () => {
    const [candidate] = selectRequeueCandidates([optionalMember], OPTIONAL_PHASE, () => "dl-opt");
    expect(candidate.downloadId).toBe("dl-opt");
  });

  it("defaults a member with no recorded phase to phase 0", () => {
    expect(tagsOf([{ ...optionalMember, phase: undefined }], 0)).toEqual(["opt-a"]);
  });

  it("tolerates a member with no reference", () => {
    const bare = { status: "downloaded", type: "requires" } as unknown as ICollectionModInstallInfo;
    expect(selectRequeueCandidates([bare], 0, allResolve)).toEqual([]);
  });
});
