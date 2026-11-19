import Module from "node:module";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { IRegisteredExtension } from "../types/extensions";
import installExtensionRequire from "./extensionRequire";

vi.mock("../api", () => ({}));
vi.mock("../controls/ReactSelectWrap", () => ({}));
vi.mock("../ExtensionManager", () => ({ default: { getExtensionPaths: () => [] } }));
vi.mock("./deprecatedApiUsage", () => ({
  deprecatedApiGet: vi.fn(),
  makeCallerReporter: () => () => undefined,
}));

const extension = {
  name: "an-extension",
  path: "/extensions/an-extension",
} as IRegisteredExtension;

/** require(), as the extension's own code calls it once extensionRequire is installed. */
const requireFromExtension = (id: string) =>
  Module.prototype.require.call({ filename: `${extension.path}/index.js` }, id);

describe("extensionRequire", () => {
  const originalRequire = Module.prototype.require;

  afterEach(() => {
    Module.prototype.require = originalRequire;
  });

  it("gives an extension react-markdown as a component that is its own default", () => {
    installExtensionRequire(
      () => [extension],
      () => ({}),
    );

    const reactMarkdown = requireFromExtension("react-markdown");

    expect(reactMarkdown).toBeTypeOf("function");
    expect(reactMarkdown.default).toBe(reactMarkdown);
    expect(requireFromExtension("react-markdown")).toBe(reactMarkdown);
  });
});
