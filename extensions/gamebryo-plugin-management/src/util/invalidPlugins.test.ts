import { describe, expect, it } from "vitest";

import { invalidPluginsFromError } from "./invalidPlugins";

describe("invalidPluginsFromError", () => {
  it("extracts the plugin from a sort-time 'is not a valid plugin' error", () => {
    expect(invalidPluginsFromError('"convenient reading.esp" is not a valid plugin')).toEqual([
      "convenient reading.esp",
    ]);
  });

  it("extracts the basename from a load-time 'invalid plugin header' error path", () => {
    const message =
      "failed validation of input plugin paths: the file at " +
      '"C:\\\\Games\\\\Skyrim Special Edition\\\\Data\\\\convenient reading.esp" ' +
      "does not have a valid plugin header";
    expect(invalidPluginsFromError(message)).toEqual(["convenient reading.esp"]);
  });

  it("collects every plugin a multi-file load error names, deduped", () => {
    const message =
      'the file at "C:\\\\Data\\\\a.esp" does not have a valid plugin header; ' +
      'the file at "C:\\\\Data\\\\b.esp" does not have a valid plugin header; ' +
      'the file at "C:\\\\Data\\\\a.esp" does not have a valid plugin header';
    expect(invalidPluginsFromError(message)).toEqual(["a.esp", "b.esp"]);
  });

  it("returns an empty list when the message names no plugin", () => {
    expect(invalidPluginsFromError("Cyclic interaction detected")).toEqual([]);
  });
});
