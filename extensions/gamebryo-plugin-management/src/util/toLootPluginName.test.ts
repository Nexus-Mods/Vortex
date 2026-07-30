import { describe, expect, it } from "vitest";

import toLootPluginName from "./toLootPluginName";

describe("toLootPluginName", () => {
  it("uses on-disk filename casing when file path is known", () => {
    const pluginList = {
      "myplugin.esp": {
        filePath: "C:\\Games\\Data\\MyPlugin.esp",
      },
    } as any;

    expect(toLootPluginName("myplugin.esp", pluginList)).toBe("MyPlugin.esp");
  });

  it("falls back to normalized plugin id when file path is missing", () => {
    expect(toLootPluginName("MyPlugin.esp", {} as any)).toBe("myplugin.esp");
  });
});
