/**
 * Disk-full classification.
 *
 * A full disk is a user problem, not a bug, and the message has to say which
 * disk: the mod staging folder, the download folder and the game can each sit
 * on a different drive.
 *
 * The errors here are the shapes a real ENOSPC actually produces - a plain node
 * error locally, and a serialized VortexError once it has crossed the
 * main/renderer boundary (which is how a failed download reaches the renderer).
 * The latter carries the code in `data` and leaves `code` undefined, so it used
 * to fall through to the generic branch and be offered up as a bug report.
 */
import { describe, expect, it } from "vitest";

import { prettifyNodeErrorMessage } from "./message";

/** A node ENOSPC, as thrown locally by fs. */
function localENOSPC(): NodeJS.ErrnoException {
  return Object.assign(new Error("ENOSPC: no space left on device, write"), {
    errno: -4055,
    code: "ENOSPC",
    syscall: "write",
  });
}

/** The same failure after the download IPC serialized it into a VortexError. */
function crossedENOSPC(path: string) {
  return Object.assign(new Error(`Failed to write to ${path}`), {
    data: {
      kind: "fs:no-space",
      originalCode: "ENOSPC",
      errno: -4055,
      syscall: "write",
      path,
    },
  });
}

describe("prettifyNodeErrorMessage - disk full", () => {
  it("reports a local ENOSPC as a full disk, not a bug", () => {
    const pretty = prettifyNodeErrorMessage(localENOSPC());

    expect(pretty.message).toMatch(/disk is full/i);
    expect(pretty.allowReport).toBe(false);
  });

  it("still recognises ENOSPC after it has crossed the process boundary", () => {
    // the regression: `code` is undefined here, so this used to return the raw
    // "No space left on device: '...'" with allowReport left unset
    const pretty = prettifyNodeErrorMessage(crossedENOSPC("X:\\downloads\\mod.7z"));

    expect(pretty.message).toMatch(/disk .*is full/i);
    expect(pretty.allowReport).toBe(false);
  });

  it("names the volume that filled up, so the right drive gets cleared", () => {
    const pretty = prettifyNodeErrorMessage(crossedENOSPC("X:\\downloads\\mod.7z"));

    expect(pretty.replace).toMatchObject({ drive: "X:\\" });
  });

  it("falls back to the generic wording when there is no path to name", () => {
    const pretty = prettifyNodeErrorMessage(localENOSPC());

    expect(pretty.message).toBe("The disk is full");
    expect(pretty.allowReport).toBe(false);
  });
});
