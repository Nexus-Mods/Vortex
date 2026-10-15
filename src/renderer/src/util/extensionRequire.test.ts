import Module from "module";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import installExtensionRequire from "./extensionRequire";

vi.mock("../ExtensionManager", () => ({
  default: { getExtensionPaths: () => [], registerUIAPI: () => undefined },
}));

describe("extensionRequire", () => {
  const original = Module.prototype.require;

  afterEach(() => {
    Module.prototype.require = original;
  });

  it.each(["vortex-api/ui", "@nexusmods/vortex-api/ui"])(
    "resolves %s to the ui namespace",
    (id) => {
      installExtensionRequire(
        () => [],
        () => ({}),
      );

      const required = Module.prototype.require.call(
        { filename: "/extensions/example/index.js" },
        id,
      );

      expect(required).toBe(api.ui);
      expect(required.Button).toBeDefined();
    },
  );
});
