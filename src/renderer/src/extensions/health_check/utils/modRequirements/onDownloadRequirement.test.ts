import { describe, expect, vi } from "vitest";

import { makeModFileInfo, makeModRequirement } from "@/test-utils/builders";
import { test } from "@/test-utils/harnessTest";
import type { IApiHarness } from "@/test-utils/harnessTypes";
import { ProcessCanceled, UserCanceled } from "@/util/api";

import { onDownloadRequirement } from "./onDownloadRequirement";

type Callback = (err: Error | null, result?: string) => void;

const REQUIREMENT = makeModRequirement();
const MAIN_FILE = makeModFileInfo();

/**
 * Answer the download and install events off the harness bus, so a test states only how each
 * step ends. An Error means that step failed; anything else means it succeeded.
 */
function wireDownloadSteps(
  harness: IApiHarness,
  steps: { download?: Error; install?: Error } = {},
): void {
  harness.api.events.on("start-download", (...args: unknown[]) => {
    const cb = args[3] as Callback;
    steps.download ? cb(steps.download) : cb(null, "dl-1");
  });
  harness.api.events.on("start-install-download", (...args: unknown[]) => {
    const cb = args[2] as Callback;
    steps.install ? cb(steps.install) : cb(null, "mod-1");
  });
}

describe("onDownloadRequirement", () => {
  test("reports success once the requirement is downloaded and installed", async ({ makeApi }) => {
    const harness = makeApi();
    wireDownloadSteps(harness);

    await expect(onDownloadRequirement(harness.api, REQUIREMENT, MAIN_FILE)).resolves.toBe(true);

    expect(harness.notifications).toEqual([
      expect.objectContaining({
        type: "success",
        message: expect.stringContaining("Required Mod"),
      }),
    ]);
    expect(harness.errorNotifications).toEqual([]);
  });

  test("refuses a requirement with no usable nexus id", async ({ makeApi }) => {
    const harness = makeApi();
    const started = vi.fn();
    harness.api.events.on("start-download", started);

    await expect(
      onDownloadRequirement(harness.api, makeModRequirement({ modId: 0 }), MAIN_FILE),
    ).resolves.toBe(false);

    expect(started).not.toHaveBeenCalled();
    expect(harness.errorNotifications).toEqual([
      expect.objectContaining({
        title: expect.stringContaining("Cannot download requirement"),
        allowReport: false,
      }),
    ]);
  });

  // the 1-click install buttons call this with `void`, so anything that escapes reaches the user
  // as an unhandled rejection behind a Report button (LAZ-836)
  describe("a failure is reported rather than thrown", () => {
    // test.for (not test.each) so the case and the harness fixture can both be destructured
    test.for([
      ["the download fails", { download: new Error("HTTP (403) - forbidden") }],
      ["the install fails", { install: new Error("archive is corrupt") }],
    ] as const)("%s", async ([, steps], { makeApi }) => {
      const harness = makeApi();
      wireDownloadSteps(harness, steps);

      await expect(onDownloadRequirement(harness.api, REQUIREMENT, MAIN_FILE)).resolves.toBe(false);

      expect(harness.errorNotifications).toEqual([
        expect.objectContaining({
          title: expect.stringContaining("Failed to install requirement"),
          allowReport: false,
        }),
      ]);
      expect(harness.notifications).toEqual([]);
    });
  });

  // backing out of the free-user download dialog is a normal way for this to end, not a failure
  describe("a cancellation ends quietly", () => {
    test.for([
      ["the user cancelled", new UserCanceled()],
      ["the flow cancelled itself", new ProcessCanceled("nothing to do")],
    ] as const)("%s", async ([, err], { makeApi }) => {
      const harness = makeApi();
      wireDownloadSteps(harness, { download: err });

      await expect(onDownloadRequirement(harness.api, REQUIREMENT, MAIN_FILE)).resolves.toBe(false);

      expect(harness.errorNotifications).toEqual([]);
      expect(harness.notifications).toEqual([]);
    });
  });
});
