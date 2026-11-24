import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { ProcessCanceled, UserCanceled } from "@/util/CustomErrors";

import { reportRemovalFailure } from "./reportRemovalFailure";

const makeApi = () => ({ sendNotification: vi.fn(), showErrorNotification: vi.fn() });

const report = (api: ReturnType<typeof makeApi>, err: unknown) =>
  reportRemovalFailure(api as unknown as IExtensionApi, "Failed to remove mods", err);

describe("reportRemovalFailure", () => {
  it("says nothing for a cancel", () => {
    const api = makeApi();

    report(api, new UserCanceled());

    expect(api.sendNotification).not.toHaveBeenCalled();
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });

  it("warns, under the title, when the removal can't go ahead", () => {
    const api = makeApi();

    report(api, new ProcessCanceled("in use"));

    expect(api.sendNotification).toHaveBeenCalledWith({
      id: "cant-remove-mod",
      type: "warning",
      title: "Failed to remove mods",
      message: "in use",
    });
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });

  it("shows anything else as an error, reportable unless it says not", () => {
    const api = makeApi();
    const corrupt = Object.assign(new Error("bad manifest"), { allowReport: false });

    report(api, new Error("boom"));
    report(api, corrupt);

    expect(api.showErrorNotification).toHaveBeenNthCalledWith(
      1,
      "Failed to remove mods",
      expect.any(Error),
      { allowReport: true },
    );
    expect(api.showErrorNotification).toHaveBeenNthCalledWith(2, "Failed to remove mods", corrupt, {
      allowReport: false,
    });
  });
});
