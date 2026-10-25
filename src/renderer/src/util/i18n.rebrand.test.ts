import { createInstance } from "i18next";
import { describe, expect, it, vi } from "vitest";

vi.mock("./getVortexPath", () => ({ default: () => "" }));

import { fallbackTFunc, RebrandPP } from "./i18n";

describe("RebrandPP", () => {
  it("shows mkeiitmods instead of Vortex in translated text", async () => {
    const i18n = createInstance();
    i18n.use(new RebrandPP());
    await i18n.init({
      lng: "de",
      fallbackLng: "en",
      postProcess: ["RebrandPP"],
      resources: { de: { translation: { "Restart Vortex": "Vortex neu starten" } } },
    });
    expect(i18n.t("Restart Vortex")).toBe("mkeiitmods neu starten");
    // untranslated keys fall back to the English text, which is renamed too
    expect(i18n.t("Vortex is ready")).toBe("mkeiitmods is ready");
  });

  it("is applied by the fallback t function used before i18n starts", () => {
    expect(fallbackTFunc("Vortex failed to start")).toBe("mkeiitmods failed to start");
  });
});
