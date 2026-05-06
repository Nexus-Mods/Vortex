import * as path from "path";

import { describe, it, expect, vi, beforeEach } from "vitest";

const { winapiState } = vi.hoisted(() => {
  const winapiState: { error: string | undefined } = { error: undefined };
  return { winapiState };
});

vi.mock("winapi-bindings", () => ({
  ShellExecuteEx: () => {
    if (winapiState.error === undefined) {
      return;
    } else {
      throw new Error(winapiState.error);
    }
  },
  RegGetValue: () => ({
    type: "REG_SZ",
    value: "foobar",
  }),
  GetVolumePathName: (input: string) => {
    const res = path.dirname(input);
    if (res === "/missing") {
      throw Object.assign(new Error("fake error"), {
        code: "ENOTFOUND",
        systemCode: 2,
      });
    }
    return res;
  },
}));

// In webpack, __non_webpack_require__ is the real Node.js require.
// In Jest (no webpack), we alias it to the normal require.
globalThis.__non_webpack_require__ = require;

let mockTmpFileCalls = 0;
let mockTmpFileReportError: string | undefined = undefined;
vi.mock("tmp", () => ({
  file: (
    _opts: Record<string, unknown>,
    callback: (err: Error | null, path: string, fd: number, cleanup: () => void) => void,
  ) => {
    if (mockTmpFileReportError) {
      return callback(new Error(mockTmpFileReportError), "", 0, () => undefined);
    }
    mockTmpFileCalls += 1;
    callback(null, "/tmp/xyz", 42, () => undefined);
  },
}));

let mockWrites: string[] = [];
let mockWriteReportError: string | undefined = undefined;

vi.mock("fs", () => ({
  write: (
    _fd: number,
    data: string,
    callback: (err: Error | null, written: number, str: string) => void,
  ) => {
    if (mockWriteReportError) {
      callback(new Error(mockWriteReportError), 0, "");
      return;
    }
    mockWrites.push(data);
    callback(null, data.length, "");
  },
  closeSync: () => {},
  existsSync: () => {
    return true;
  },
  readFileSync: () => {
    return "";
  },
}));

import { runElevated, type IElevatedIpc } from "./elevated";

function dummy(_ipc: IElevatedIpc, _req: NodeJS.Require) {
  console.log("DUMMY FUNCTION");
}

describe("runElevated", () => {
  beforeEach(() => {
    mockTmpFileCalls = 0;
    mockTmpFileReportError = undefined;
    mockWrites = [];
    mockWriteReportError = undefined;
    winapiState.error = undefined;
  });

  it("creates a temporary file", () => {
    return runElevated("ipcPath", dummy).then(() => {
      expect(mockTmpFileCalls).toBe(1);
    });
  });

  it("writes a function to the temp file", () => {
    return runElevated("ipcPath", dummy).then(() => {
      expect(mockWrites.length).toBe(1);
      expect(mockWrites[0]).toContain("let moduleRoot =");
      expect(mockWrites[0]).toContain("let main = function dummy");
      expect(mockWrites[0]).toContain("DUMMY FUNCTION");
    });
  });

  it("passes arguments", () => {
    return runElevated("ipcPath", dummy, {
      answer: 42,
      truth: true,
      str: "string",
      array: [1, 2, 3],
    }).then(() => {
      expect(mockWrites[0]).toContain("let answer = 42;");
      expect(mockWrites[0]).toContain("let truth = true;");
      expect(mockWrites[0]).toContain('let str = "string";');
      expect(mockWrites[0]).toContain("let array = [1,2,3];");
    });
  });

  it("handles tmp file errors", () => {
    mockTmpFileReportError = "i haz error";
    return runElevated("ipcPath", dummy)
      .then(() => {
        expect.fail("expected error");
      })
      .catch((err: Error) => {
        expect(err.message).toBe("i haz error");
      });
  });

  it("handles write errors", () => {
    mockWriteReportError = "i haz error";
    return runElevated("ipcPath", dummy)
      .then(() => {
        expect.fail("expected error");
      })
      .catch((err: Error) => {
        expect(err.message).toBe("i haz error");
      });
  });

  it("handles library errors", () => {
    winapiState.error = "i haz error";
    return runElevated("ipcPath", dummy)
      .then(() => {
        expect.fail("expected error");
      })
      .catch((err: Error) => {
        expect(err.message).toBe("i haz error");
      });
  });
});
