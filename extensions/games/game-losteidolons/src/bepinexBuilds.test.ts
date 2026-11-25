import { describe, expect, it } from "vitest";

import { resolveLatestBepInExBuild } from "./bepinexBuilds";

describe("resolveLatestBepInExBuild", () => {
  it("selects the newest Windows x64 IL2CPP archive", () => {
    const html = `
      <a href="/projects/bepinex_be/794/mono.zip">BepInEx-Unity.Mono-win-x64-6.0.0-be.794+abc.zip</a>
      <a href="/projects/bepinex_be/794/il2cpp.zip">BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.794+abc.zip</a>
      <a href="/projects/bepinex_be/793/il2cpp.zip">BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.793+def.zip</a>
    `;

    expect(resolveLatestBepInExBuild(html)).toEqual({
      archiveName: "BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.794+abc.zip",
      downloadUrl: "https://builds.bepinex.dev/projects/bepinex_be/794/il2cpp.zip",
    });
  });

  it("fails explicitly when no matching build is listed", () => {
    expect(() => resolveLatestBepInExBuild("<html></html>")).toThrow(
      "No Windows x64 IL2CPP BepInEx build was found",
    );
  });
});
