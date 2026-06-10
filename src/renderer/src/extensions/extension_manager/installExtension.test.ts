import * as path from "path";

import { describe, expect, it, vi } from "vitest";

import { forgetExtension } from "../../actions";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { clearStaleRemovalFlags } from "./installExtension";

// Regression test for #23295: previously cleared every `remove: true` flag
// after install, which orphaned old-version folders. Verify path matching
// handles key/folder-name divergence and case-insensitive comparison.
describe("clearStaleRemovalFlags", () => {
  const extensionsPath = path.join("C:", "ProgramData", "vortex", "plugins");

  const makeApi = (
    installed: Record<string, { path: string }>,
  ): { api: IExtensionApi; dispatch: ReturnType<typeof vi.fn> } => {
    const dispatch = vi.fn();
    const api = {
      store: {
        dispatch,
        getState: () => ({ session: { extensions: { installed } } }),
      },
    } as unknown as IExtensionApi;
    return { api, dispatch };
  };

  it("dispatches forgetExtension when a previous entry points at destPath", () => {
    const destPath = path.join(extensionsPath, "ext-name");
    const { api, dispatch } = makeApi({
      "ext-name": { path: destPath },
    });

    clearStaleRemovalFlags(api, ["ext-name"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(forgetExtension("ext-name"));
  });

  it("leaves the remove flag set when previous folders are distinct from destPath", () => {
    // ChemBoy1's shape: prior installs sit in version-stamped folders that
    // don't share a path with the new install's destination.
    const destPath = path.join(extensionsPath, "Crimson Desert Vortex Extension v0.4.2");
    const { api, dispatch } = makeApi({
      "Crimson Desert Vortex Extension v0.4.0": {
        path: path.join(extensionsPath, "Crimson Desert Vortex Extension v0.4.0"),
      },
      "Crimson Desert Vortex Extension v0.4.1": {
        path: path.join(extensionsPath, "Crimson Desert Vortex Extension v0.4.1"),
      },
    });

    clearStaleRemovalFlags(
      api,
      ["Crimson Desert Vortex Extension v0.4.0", "Crimson Desert Vortex Extension v0.4.1"],
      destPath,
    );

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("only clears the matching entry when same-path and distinct-path keys are mixed", () => {
    const destPath = path.join(extensionsPath, "ext v2");
    const { api, dispatch } = makeApi({
      "ext v1": { path: path.join(extensionsPath, "ext v1") },
      "ext v2": { path: destPath },
      "ext v0": { path: path.join(extensionsPath, "ext v0") },
    });

    clearStaleRemovalFlags(api, ["ext v1", "ext v2", "ext v0"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(forgetExtension("ext v2"));
  });

  it("matches the path even when the state key differs from the folder basename", () => {
    // The case the original `key === path.basename(destPath)` shortcut missed:
    // info.json's `id` field decoupled the state key from the folder name, so
    // a same-folder reinstall would not have cleared the flag and the freshly
    // installed folder would have been wiped on the next launch.
    const destPath = path.join(extensionsPath, "crimson-desert-folder");
    const { api, dispatch } = makeApi({
      "crimson-desert-id": { path: destPath },
    });

    clearStaleRemovalFlags(api, ["crimson-desert-id"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(forgetExtension("crimson-desert-id"));
  });

  it("treats path comparison as case-insensitive (Windows filesystem semantics)", () => {
    const destPath = path.join(extensionsPath, "ext-name");
    const { api, dispatch } = makeApi({
      "ext-name": { path: destPath.toUpperCase() },
    });

    clearStaleRemovalFlags(api, ["ext-name"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no matching installed entries", () => {
    const destPath = path.join(extensionsPath, "ext-name");
    const { api, dispatch } = makeApi({});

    clearStaleRemovalFlags(api, [], destPath);
    clearStaleRemovalFlags(api, ["stale-key"], destPath);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
