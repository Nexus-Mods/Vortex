import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  log: vi.fn(),
}));

vi.mock("../extensions/analytics/mixpanel/MixpanelAnalytics", () => ({
  default: { trackEvent: mocks.trackEvent },
}));

vi.mock("../logging", () => ({
  log: mocks.log,
}));

import type { IRegisteredExtension } from "../types/extensions";
import { deprecatedApiGet } from "./deprecatedApiUsage";
// eslint-disable-next-line no-restricted-imports -- tests the util.opn shim itself
import opn from "./opn";

const openUrl = vi.fn();
const openFile = vi.fn();

const makeExt = (name: string): IRegisteredExtension => ({
  name,
  namespace: name,
  path: `/plugins/${name}`,
  dynamic: false,
  initFunc: () => () => true,
});

const utilFor = (extName: string) =>
  deprecatedApiGet({ util: { opn } }, "util", "", makeExt(extName), undefined);

describe("util.opn in the extension api", () => {
  beforeEach(() => {
    openUrl.mockClear();
    openFile.mockClear();
    mocks.trackEvent.mockClear();
    mocks.log.mockClear();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl, openFile } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a call and still opens the target", async () => {
    await utilFor("ext-a").opn("https://example.com/mod");

    expect(openUrl).toHaveBeenCalledWith("https://example.com/mod");
    expect(mocks.trackEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackEvent.mock.calls[0][0].properties).toEqual({
      api_method: "util.opn",
      extension_name: "ext-a",
      extension_version: undefined,
      mod_id: undefined,
      file_id: undefined,
      bundled: false,
    });
    expect(mocks.log).toHaveBeenCalledWith("warn", '"util.opn" is deprecated', {
      replacement: "api.openUrl or api.openFile",
      api_method: "util.opn",
      extension_name: "ext-a",
      extension_version: undefined,
      mod_id: undefined,
      file_id: undefined,
      bundled: false,
    });
  });

  it("opens a path as a file", async () => {
    await utilFor("ext-b").opn("C:\\Games\\Skyrim");

    expect(openFile).toHaveBeenCalledWith("C:\\Games\\Skyrim");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("does not report reading util.opn without calling it", () => {
    const { opn: unused } = utilFor("ext-c");

    expect(unused).toBeTypeOf("function");
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });
});
