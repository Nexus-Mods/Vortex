import { describe, expect, it } from "vitest";

import { calcDuration, MAX_TOAST_MS, prettifyNodeErrorMessage, toastDuration } from "./message";

describe("calcDuration", () => {
  it("gives a short message the 2s minimum", () => {
    expect(calcDuration(0)).toBe(2000);
    expect(calcDuration(10)).toBe(2000);
  });

  it("caps a long message at 7s", () => {
    expect(calcDuration(140)).toBe(7000);
    expect(calcDuration(1000)).toBe(7000);
  });

  it("scales by 50ms a character in between", () => {
    expect(calcDuration(60)).toBe(3000);
    expect(calcDuration(100)).toBe(5000);
  });
});

describe("toastDuration", () => {
  it("follows calcDuration while it fits in a toast", () => {
    expect(toastDuration(10)).toBe(calcDuration(10));
    expect(toastDuration(60)).toBe(calcDuration(60));
  });

  it("caps a long message at the toast limit, so it stays a toast", () => {
    expect(toastDuration(140)).toBe(MAX_TOAST_MS);
  });
});

const nodeError = (fields: Record<string, unknown>) => Object.assign(new Error("raw"), fields);

describe("prettifyNodeErrorMessage", () => {
  it("reports EACCES on a file as a permission problem", () => {
    const err = prettifyNodeErrorMessage(
      nodeError({ code: "EACCES", syscall: "spawn", path: "/tools/SSEEdit.exe" }),
    );
    expect(err.message).toContain("denied access");
    expect(err.replace).toEqual({ filePath: "/tools/SSEEdit.exe" });
  });

  it("still reports EACCES on a network connection as a firewall problem", () => {
    const err = prettifyNodeErrorMessage(nodeError({ code: "EACCES", port: 443 }));
    expect(err.message).toContain("firewall");
  });
});
