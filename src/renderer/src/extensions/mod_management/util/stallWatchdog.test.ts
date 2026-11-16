import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeApiHarness } from "../../../test-utils/builders";
import {
  createUserWaitTracker,
  DIALOG_WAIT_LIMIT_MS,
  selectStalledMemberInstalls,
} from "./stallWatchdog";

const MIN_AGE_MS = 60 * 1000;
const NOW = 10 * 60 * 1000;

const entry = (installId: string, runningForMs: number) => ({
  installId,
  startTime: NOW - runningForMs,
});

describe("selectStalledMemberInstalls", () => {
  it("picks the stalled collection's members past the grace period", () => {
    // started after the collection last made progress, so younger than a five minute stall
    const member = entry("col-1:dl-a", 4 * 60 * 1000);

    expect(selectStalledMemberInstalls([member], "col-1", MIN_AGE_MS, NOW)).toEqual([member]);
  });

  it("leaves a member that only just started", () => {
    const recent = entry("col-1:dl-a", 30 * 1000);

    expect(selectStalledMemberInstalls([recent], "col-1", MIN_AGE_MS, NOW)).toEqual([]);
  });

  it("picks every member when there is no grace period", () => {
    const recent = entry("col-1:dl-a", 0);

    expect(selectStalledMemberInstalls([recent], "col-1", 0, NOW)).toEqual([recent]);
  });

  it("leaves installs that aren't this collection's members", () => {
    const installs = [
      // the collection archive's own install has no source collection
      entry("undefined:dl-collection", MIN_AGE_MS * 10),
      // another collection's member
      entry("col-2:dl-a", MIN_AGE_MS * 10),
      // a collection whose id starts with this one's
      entry("col-10:dl-a", MIN_AGE_MS * 10),
    ];

    expect(selectStalledMemberInstalls(installs, "col-1", MIN_AGE_MS, NOW)).toEqual([]);
  });
});

describe("createUserWaitTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const openDialog = (setState: ReturnType<typeof makeApiHarness>["setState"], id: string) =>
    setState((draft) => {
      draft.session.notifications = {
        notifications: [],
        global_notifications: [],
        dialogs: [{ id, type: "question", title: "", content: {}, defaultAction: "", actions: [] }],
      };
    });

  it("is false with no dialog open", () => {
    const { api } = makeApiHarness();

    expect(createUserWaitTracker()(api)).toBe(false);
  });

  it("is true while a modal dialog is queued", () => {
    const { api, setState } = makeApiHarness();
    openDialog(setState, "replace-prompt");

    expect(createUserWaitTracker()(api)).toBe(true);
  });

  it("stops counting a dialog that has been open past the limit", () => {
    // nothing says whether the dialog belongs to an install, so it can't hold the clock forever
    const { api, setState } = makeApiHarness();
    openDialog(setState, "error-report");
    const isWaitingOnUser = createUserWaitTracker();

    expect(isWaitingOnUser(api)).toBe(true);
    vi.advanceTimersByTime(DIALOG_WAIT_LIMIT_MS - 1000);
    expect(isWaitingOnUser(api)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(isWaitingOnUser(api)).toBe(false);
  });

  it("gives the next dialog its own limit", () => {
    const { api, setState } = makeApiHarness();
    openDialog(setState, "error-report");
    const isWaitingOnUser = createUserWaitTracker();
    isWaitingOnUser(api);
    vi.advanceTimersByTime(DIALOG_WAIT_LIMIT_MS);
    expect(isWaitingOnUser(api)).toBe(false);

    openDialog(setState, "replace-prompt");

    expect(isWaitingOnUser(api)).toBe(true);
  });

  it("is true for as long as a FOMOD installer dialog is open", () => {
    const { api, setState } = makeApiHarness();
    setState((draft) => {
      Object.assign(draft.session, {
        fomod: { installer: { dialog: { activeInstanceId: "fomod-1", instances: {} } } },
      });
    });
    const isWaitingOnUser = createUserWaitTracker();

    expect(isWaitingOnUser(api)).toBe(true);
    vi.advanceTimersByTime(DIALOG_WAIT_LIMIT_MS * 2);
    expect(isWaitingOnUser(api)).toBe(true);
  });
});
