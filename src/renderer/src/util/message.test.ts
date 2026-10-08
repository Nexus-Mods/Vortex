import { describe, expect, it } from "vitest";

import { prettifyNodeErrorMessage } from "./message";

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
