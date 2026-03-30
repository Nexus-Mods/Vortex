import { describe, it, expect } from "vitest";
import * as shimNs from "./winapi-shim";
import shimDefault from "./winapi-shim";
import {
  GetDiskFreeSpaceEx,
  GetVolumePathName,
  ShellExecuteEx,
  RegGetValue,
  GetNativeArch,
  GetProcessList,
  IsThisWine,
  SupportsAppContainer,
  GetProcessToken,
  CheckYourPrivilege,
  WalkDir,
  Access,
} from "./winapi-shim";

describe("GetDiskFreeSpaceEx", () => {
  it("returns total, free, freeToCaller as positive numbers for /tmp", () => {
    const result = GetDiskFreeSpaceEx("/tmp");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("free");
    expect(result).toHaveProperty("freeToCaller");
    expect(typeof result.total).toBe("number");
    expect(typeof result.free).toBe("number");
    expect(typeof result.freeToCaller).toBe("number");
    expect(result.total).toBeGreaterThan(0);
    expect(result.free).toBeGreaterThan(0);
    expect(result.freeToCaller).toBeGreaterThan(0);
  });

  it("throws or returns for a nonexistent path (caller catches)", () => {
    // Callers already catch errors; just verify it doesn't crash the test with something unexpected
    try {
      GetDiskFreeSpaceEx("/nonexistent/path/abc123xyz987");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});

describe("GetVolumePathName", () => {
  it("returns a non-empty string for /tmp", () => {
    const result = GetVolumePathName("/tmp");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns '/' as fallback for nonexistent path (ENOENT)", () => {
    const result = GetVolumePathName("/nonexistent/path/abc123xyz987");
    expect(result).toBe("/");
  });
});

describe("ShellExecuteEx", () => {
  it("throws an Error whose message contains 'Linux'", () => {
    expect(() => ShellExecuteEx({} as any)).toThrow(Error);
    expect(() => ShellExecuteEx({} as any)).toThrow(/Linux/);
  });
});

describe("no-op stubs", () => {
  it("RegGetValue returns undefined", () => {
    expect(RegGetValue("HKEY_LOCAL_MACHINE" as any, "path", "key")).toBeUndefined();
  });

  it("GetProcessList returns []", () => {
    expect(GetProcessList()).toEqual([]);
  });

  it("IsThisWine returns false", () => {
    expect(IsThisWine()).toBe(false);
  });

  it("SupportsAppContainer returns false", () => {
    expect(SupportsAppContainer()).toBe(false);
  });

  it("GetProcessToken('elevation') returns { isElevated: false }", () => {
    expect(GetProcessToken("elevation")).toEqual({ isElevated: false });
  });

  it("CheckYourPrivilege returns []", () => {
    expect(CheckYourPrivilege()).toEqual([]);
  });
});

describe("GetNativeArch", () => {
  it("returns object with nativeArch equal to process.arch", () => {
    const result = GetNativeArch();
    expect(result).toHaveProperty("nativeArch", process.arch);
    expect(result).toHaveProperty("nativeMachineCode", 0);
    expect(result).toHaveProperty("usedFallback", false);
  });
});

describe("WalkDir", () => {
  it("calls callback with null or undefined without throwing (3-arg form)", () => {
    let cbArg: unknown = "NOT_CALLED";
    WalkDir("/tmp", () => true, (err: Error | null) => {
      cbArg = err;
    });
    expect(cbArg === null || cbArg === undefined).toBe(true);
  });

  it("calls callback with null when options object provided (4-arg form)", () => {
    let cbArg: unknown = "NOT_CALLED";
    WalkDir("/tmp", () => true, {}, (err: Error | null) => {
      cbArg = err;
    });
    expect(cbArg === null || cbArg === undefined).toBe(true);
  });
});

describe("Access constant", () => {
  it("Access.Grant is a function", () => {
    expect(typeof Access.Grant).toBe("function");
  });

  it("Access.Deny is a function", () => {
    expect(typeof Access.Deny).toBe("function");
  });

  it("Access.Revoke is a function", () => {
    expect(typeof Access.Revoke).toBe("function");
  });
});

describe("export completeness", () => {
  it("all named exports are typeof function or object", () => {
    for (const [key, val] of Object.entries(shimNs)) {
      if (key === "default") continue;
      const t = typeof val;
      expect(["function", "object"], `${key} should be function or object`).toContain(t);
    }
  });

  it("default export contains every named export key", () => {
    for (const key of Object.keys(shimNs)) {
      if (key === "default") continue;
      expect(shimDefault, `default export should have key ${key}`).toHaveProperty(key);
    }
  });
});
