import { DataInvalid } from "@vortex/shared/errors";
/**
 * Analytics integration tests for InstallContext: drive the REAL InstallContext (via the
 * makeInstallContext harness) through startInstallCB/finishInstallCB and assert the per-mod
 * mods_installation_* events it emits - names, collection_id, duration, and classified error_code.
 * finishInstallCB is the exactly-once terminal hook where these now fire (the mod is still
 * resolvable via the archive), so this exercises the real emit path end to end.
 */
import { describe, expect } from "vitest";

import { makeDownload, makeModInfo } from "../../test-utils/builders";
import { test } from "../../test-utils/installContextTest";
import type { IModInfo } from "../download_management/types/IDownload";

const GAME = "skyrimse";
const ARCHIVE = "arch-1";
const MOD = "mod-1";

function memberInfo(extra: Record<string, unknown> = {}): IModInfo {
  return makeModInfo({ nexus: { ids: { modId: 100, fileId: 200, gameId: GAME }, ...extra } });
}
const withDownload = (modInfo: IModInfo) => ({
  downloads: { [ARCHIVE]: makeDownload({ id: ARCHIVE, modInfo }) },
});
const names = (h: { mixpanelEvents: { eventName: string }[] }) =>
  h.mixpanelEvents.map((e) => e.eventName);

describe("InstallContext per-mod analytics", () => {
  test("startInstallCB emits mods_installation_started with a null collection_id for a standalone mod", ({
    makeInstallContext,
  }) => {
    const h = makeInstallContext(withDownload(memberInfo()));
    h.ctx.startInstallCB(MOD, GAME, ARCHIVE);
    expect(names(h)).toEqual(["mods_installation_started"]);
    expect(h.mixpanelEvents[0].properties).toMatchObject({
      mod_id: "100",
      file_id: "200",
      collection_id: null,
    });
  });

  test("carries the parent collection_id for a collection member", ({ makeInstallContext }) => {
    const h = makeInstallContext(withDownload(memberInfo({ parentCollectionId: "col-9" })));
    h.ctx.startInstallCB(MOD, GAME, ARCHIVE);
    expect(h.mixpanelEvents[0].properties.collection_id).toBe("col-9");
  });

  test("does not emit for the collection container itself", ({ makeInstallContext }) => {
    const h = makeInstallContext(
      withDownload(
        makeModInfo({ nexus: { ids: { collectionSlug: "s", revisionId: 5, gameId: GAME } } }),
      ),
    );
    h.ctx.startInstallCB(MOD, GAME, ARCHIVE);
    expect(h.mixpanelEvents).toHaveLength(0);
  });

  test("finishInstallCB success emits completed with a duration and the collection_id", ({
    makeInstallContext,
  }) => {
    const h = makeInstallContext(withDownload(memberInfo({ parentCollectionId: "col-9" })));
    h.ctx.startInstallCB(MOD, GAME, ARCHIVE);
    h.ctx.finishInstallCB("success", {});
    const completed = h.mixpanelEvents.find((e) => e.eventName === "mods_installation_completed");
    expect(completed).toBeDefined();
    expect(completed?.properties.collection_id).toBe("col-9");
    expect(typeof completed?.properties.duration_ms).toBe("number");
  });

  test("finishInstallCB canceled emits the cancelled event", ({ makeInstallContext }) => {
    const h = makeInstallContext(withDownload(memberInfo()));
    h.ctx.startInstallCB(MOD, GAME, ARCHIVE);
    h.ctx.finishInstallCB("canceled");
    expect(names(h)).toContain("mods_installation_cancelled");
  });

  test("finishInstallCB failed classifies the error into error_code and carries the reason", ({
    makeInstallContext,
  }) => {
    const h = makeInstallContext(withDownload(memberInfo()));
    h.ctx.startInstallCB(MOD, GAME, ARCHIVE);
    h.ctx.finishInstallCB("failed", undefined, "bad archive", new DataInvalid("bad archive"));
    const failed = h.mixpanelEvents.find((e) => e.eventName === "mods_installation_failed");
    expect(failed?.properties).toMatchObject({
      error_code: "data_invalid",
      error_message: "bad archive",
    });
  });
});
