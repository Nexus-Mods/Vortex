import { describe, expect, it } from "vitest";

import { calcDuration, prettifyNodeErrorMessage } from "./message";

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
