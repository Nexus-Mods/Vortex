import { describe, expect, it } from "vitest";

import { NativePathResolver } from "./native-resolver";
import { PathResolverError } from "./paths";
import { QualifiedPath } from "./paths";

describe("NativePathResolver", () => {
  const resolver = new NativePathResolver();

  it.each([
    ["C:\\Users\\alice\\file.txt", "C:\\Users\\alice\\file.txt"],
    ["C:\\", "C:\\"],
    ["/home/alice/file.txt", "/home/alice/file.txt"],
    ["/", "/"],
    ["\\\\server\\share\\file.txt", "\\\\server\\share\\file.txt"],
    ["\\\\?\\C:\\x", "\\\\?\\C:\\x"],
    [
      "\\\\.\\Volume{b75e2c83-0000-0000-0000-602f00000000}\\",
      "\\\\.\\Volume{b75e2c83-0000-0000-0000-602f00000000}\\",
    ],
  ])("resolve(fromNative('%s')) === '%s'", async (raw, expected) => {
    const resolved = await resolver.resolve(QualifiedPath.fromNative(raw));
    expect(resolved).toBe(expected);
  });

  it("round-trips fromNative byte-for-byte", async () => {
    for (const raw of [
      "C:\\Users\\alice\\file.txt",
      "/home/alice/file.txt",
      "\\\\server\\share\\file.txt",
      "\\\\?\\C:\\x",
    ]) {
      expect(await resolver.resolve(QualifiedPath.fromNative(raw))).toBe(raw);
    }
  });

  it("rejects foreign schemes", async () => {
    await expect(
      resolver.resolve(QualifiedPath.of({ scheme: "steam", data: "", path: "x", root: "" })),
    ).rejects.toBeInstanceOf(PathResolverError);
  });
});
