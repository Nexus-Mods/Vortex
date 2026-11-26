import { describe, expect, it } from "vitest";

import { extractToken } from "./genHash";

const errorWithFrame = (frame: string) => ({
  message: "boom",
  stack: `Error: boom\n    at ${frame}`,
});

describe("extractToken", () => {
  it("drops the install path from an anonymous frame", () => {
    expect(
      extractToken(
        errorWithFrame(String.raw`C:\Program Files\Vortex\resources\app.asar\renderer.js:2:5`),
      ),
    ).toBe("Error: boom\n    at renderer.js:2:5");
  });

  it("drops the install path from an anonymous frame with a file URL", () => {
    expect(
      extractToken(
        errorWithFrame("file:///C:/Program%20Files/Vortex/resources/app.asar/renderer.mjs:2:5"),
      ),
    ).toBe("Error: boom\n    at renderer.mjs:2:5");
  });

  it("gives the same token for the same frame in different install folders", () => {
    const a = errorWithFrame(
      "file:///C:/Program%20Files/Vortex/resources/app.asar/renderer.mjs:2:5",
    );
    const b = errorWithFrame("file:///D:/Games/Vortex/resources/app.asar/renderer.mjs:2:5");
    expect(extractToken(a)).toBe(extractToken(b));
  });
});
