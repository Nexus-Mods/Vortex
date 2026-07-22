import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IDownload } from "../../types/IState";
import { ProcessCanceled } from "../../util/CustomErrors";
import { waitForDownloadRecord } from "./util";

// Regression test for #23454: downloads run in the main process and the
// renderer redux state is synced asynchronously, so the download record may
// be absent or still "finalizing" when the download callback resolves. The
// extension updater then failed with "Download not found" on every launch.
describe("waitForDownloadRecord", () => {
  const makeApi = (files: () => Record<string, Partial<IDownload>>): IExtensionApi =>
    ({
      getState: () => ({ persistent: { downloads: { files: files() } } }),
    }) as unknown as IExtensionApi;

  it("resolves immediately when the download is finished", async () => {
    const api = makeApi(() => ({
      dl1: { state: "finished", localPath: "archive.7z" },
    }));

    const result = await waitForDownloadRecord(api, "dl1", 1000, 10);
    expect(result.localPath).toBe("archive.7z");
  });

  it("polls until the record appears in the store", async () => {
    let synced = false;
    const api = makeApi(() =>
      synced ? { dl1: { state: "finished", localPath: "archive.7z" } } : {},
    );
    setTimeout(() => {
      synced = true;
    }, 30);

    const result = await waitForDownloadRecord(api, "dl1", 1000, 10);
    expect(result.localPath).toBe("archive.7z");
  });

  it("polls while the download is still finalizing", async () => {
    let state: IDownload["state"] = "finalizing";
    const api = makeApi(() => ({ dl1: { state, localPath: "archive.7z" } }));
    setTimeout(() => {
      state = "finished";
    }, 30);

    const result = await waitForDownloadRecord(api, "dl1", 1000, 10);
    expect(result.state).toBe("finished");
  });

  it("rejects with ProcessCanceled when the download failed", async () => {
    const api = makeApi(() => ({ dl1: { state: "failed" } }));

    await expect(waitForDownloadRecord(api, "dl1", 1000, 10)).rejects.toThrow(ProcessCanceled);
  });

  it("rejects after the timeout when the record never appears", async () => {
    const api = makeApi(() => ({}));

    await expect(waitForDownloadRecord(api, "dl1", 50, 10)).rejects.toThrow("Download not found");
  });

  it("rejects after the timeout when the record never finishes", async () => {
    const api = makeApi(() => ({ dl1: { state: "finalizing" } }));

    await expect(waitForDownloadRecord(api, "dl1", 50, 10)).rejects.toThrow(
      "Download not finished (state: finalizing)",
    );
  });
});
