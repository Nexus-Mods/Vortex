import { describe, expect, vi } from "vitest";

import type { MixpanelEvent } from "./extensions/analytics/mixpanel/MixpanelEvents";
import type { IDownload } from "./extensions/download_management/types/IDownload";
import { test } from "./test-utils/downloadAdapterTest";
import type { IDownloadAdapterHarness } from "./test-utils/harnessTypes";

// getDownloadPath reads electron's userData dir via ApplicationData, which isn't initialized in the
// test env.
vi.mock("./util/getVortexPath", () => ({ default: () => "/vortex-userdata" }));

// The Nexus games list is a module cache that's empty in tests; Stardew Valley is 1303 on the site.
vi.mock("./extensions/analytics/mixpanel/numericGameId", () => ({
  numericNexusGameId: (id: string) => (id === "stardewvalley" ? 1303 : null),
}));

/** A Browse 1-click download whose record holds the mod and file but no Nexus game yet. */
const BROWSE_DOWNLOAD: Partial<IDownload> = {
  state: "paused",
  game: ["stardewvalley"],
  received: 0,
  modInfo: { downloadSource: "browse", nexus: { ids: { modId: 55894, fileId: 192243 } } },
};

/** The identity every one of the download's events carries. */
const IDENTITY = {
  mod_id: "55894",
  file_id: "192243",
  game_id: 1303,
  mod_uid: "5596342442582",
  file_uid: "5596342578931",
  collection_id: null,
  revision_id: null,
  download_source: "browse",
};

const wireState = (status: string, bytesReceived: number) => ({
  status,
  error: null,
  bytesReceived,
  size: 100,
  fileName: undefined,
  isChunked: false,
});

/** Restarts the seeded download, and collects the mixpanel events the adapter emits after. */
async function startTracked(h: IDownloadAdapterHarness): Promise<MixpanelEvent[]> {
  const events: MixpanelEvent[] = [];
  h.events.emit("resume-download", h.downloadId, () => undefined);
  await h.started.promise;
  h.events.on("analytics-track-mixpanel-event", (event: MixpanelEvent) => events.push(event));
  return events;
}

/** Hands the adapter the download's next state, and lets its poll pick it up. */
async function poll(h: IDownloadAdapterHarness, status: string, bytesReceived: number) {
  h.getStates.mockResolvedValue({ [h.downloadId]: wireState(status, bytesReceived) });
  await vi.advanceTimersByTimeAsync(200);
}

const named = (events: MixpanelEvent[], eventName: string) =>
  events.filter((event) => event.eventName === eventName).map((event) => event.properties);

describe("mod download analytics", () => {
  test("tracks the download starting, with its source and the game it's for", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter({ download: BROWSE_DOWNLOAD });
    const events = await startTracked(h);

    await poll(h, "running", 50);

    expect(named(events, "mods_download_started_client")).toEqual([IDENTITY]);
  });

  test("tracks the download completing", async ({ makeDownloadAdapter }) => {
    const h = makeDownloadAdapter({ download: BROWSE_DOWNLOAD });
    const events = await startTracked(h);

    await poll(h, "completed", 100);

    expect(named(events, "mods_download_completed")).toEqual([
      {
        ...IDENTITY,
        file_size: 100,
        duration_ms: expect.any(Number),
        pause_count: 0,
        was_resumed: false,
      },
    ]);
  });

  test("tracks the download being cancelled", async ({ makeDownloadAdapter }) => {
    const h = makeDownloadAdapter({ download: BROWSE_DOWNLOAD });
    const events = await startTracked(h);

    await poll(h, "canceled", 50);

    expect(named(events, "mods_download_cancelled")).toEqual([IDENTITY]);
  });

  test("tracks the download failing", async ({ makeDownloadAdapter }) => {
    const h = makeDownloadAdapter({ download: BROWSE_DOWNLOAD });
    const events = await startTracked(h);

    await poll(h, "failed", 50);

    expect(named(events, "mods_download_failed")).toEqual([
      { ...IDENTITY, error_code: "unknown", error_message: "", pause_count: 0, was_resumed: false },
    ]);
  });
});
