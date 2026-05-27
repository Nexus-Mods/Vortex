import { describe, expect, it } from "vitest";

import { testSupported } from "./tester";

describe("fomod native testSupported (APP-483)", () => {
  // In 2.1 the native addon failed to load, so it reported every interactive
  // fomod as unsupported and installs fell through to the fallback installer
  // with no dialog. The first test guards that load; the others pin the routing
  // in tester.ts. Native detection rules are owned and tested upstream, so we don't
  // re-assert them.
  const xmlScriptFiles = ["fomod/", "fomod/ModuleConfig.xml", "textures/example.dds"];

  it("supports an interactive XmlScript fomod so the installer dialog is shown", async () => {
    // Load guard: if the addon fails to load, this reports unsupported and fails.
    const result = await testSupported(xmlScriptFiles, { hasXmlConfigXML: true }, false);

    expect(result.supported).toBe(true);
  });

  it("short-circuits to unsupported when details report no XmlScript config", async () => {
    const result = await testSupported(xmlScriptFiles, { hasXmlConfigXML: false }, false);

    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });

  it("routes to the Basic handler when isBasic is set", async () => {
    const result = await testSupported(["data/a.esp"], undefined, true);

    expect(result.supported).toBe(true);
  });
});
