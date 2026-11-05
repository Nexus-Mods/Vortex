import { EventEmitter } from "events";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionContext, IPreviewFile } from "../../types/IExtensionContext";
import init from "./index";

const openFile = vi.fn();
const showDialog = vi.fn();
const events = new EventEmitter();

const files: IPreviewFile[] = [
  { label: "readme", filePath: "/mods/a/readme.txt" },
  { label: "changelog", filePath: "/mods/a/changelog.txt" },
];

describe("file_preview fallback", () => {
  // The handlers live in a module-level list, so the extension is set up once for the file.
  beforeAll(() => {
    const onceCallbacks: Array<() => void> = [];
    init({
      api: { events, showDialog },
      once: (cb: () => void) => onceCallbacks.push(cb),
    } as unknown as IExtensionContext);
    onceCallbacks.forEach((cb) => cb());
  });

  beforeEach(() => {
    openFile.mockClear();
    showDialog.mockReset();
    vi.stubGlobal("api", { ...window.api, shell: { openFile } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens each picked file with the OS default app", async () => {
    showDialog.mockResolvedValue({
      action: "Open",
      input: { "/mods/a/readme.txt": true, "/mods/a/changelog.txt": false },
    });

    events.emit("preview-files", files);

    await vi.waitFor(() => expect(openFile).toHaveBeenCalledWith("/mods/a/readme.txt"));
    expect(openFile).toHaveBeenCalledTimes(1);
  });

  it("opens nothing when the user cancels", async () => {
    const cb = vi.fn();
    showDialog.mockResolvedValue({ action: "Cancel", input: {} });

    events.emit("preview-files", files, cb);

    await vi.waitFor(() => expect(cb).toHaveBeenCalledWith(null));
    expect(openFile).not.toHaveBeenCalled();
  });
});
