import { describe, expect, it } from "vitest";

import { testSupported } from "./tester";

// Regression coverage for APP-483. These drive the public testSupported (the
// entry point registered in index.ts) against the *real* native module, so
// they exercise both the Vortex-side routing and the native addon loading that
// broke in 2.1. Back then the XmlScript handler (isBasic = false) reported
// every interactive fomod as unsupported - the addon failed to load and never
// reported support - so installs fell through to the generic fallback
// installer with no dialog. A load regression makes the supported cases fail.
//
// Note: the native addon ships prebuilds only for linux-x64 and win32-x64 (the
// CI matrix). On other arches it would attempt a source build.

describe("fomod native testSupported (APP-483)", () => {
  const xmlScriptFiles = ["fomod/", "fomod/ModuleConfig.xml", "textures/example.dds"];

  it("supports an interactive XmlScript fomod so the installer dialog is shown", async () => {
    const result = await testSupported(xmlScriptFiles, { hasXmlConfigXML: true }, false);

    expect(result.supported).toBe(true);
    expect(result.requiredFiles).toContain("fomod/ModuleConfig.xml");
  });

  it("recognises an XmlScript fomod nested under a top-level folder", async () => {
    const files = ["See Through Scopes/fomod/ModuleConfig.xml", "See Through Scopes/data/a.esp"];

    const result = await testSupported(files, { hasXmlConfigXML: true }, false);

    expect(result.supported).toBe(true);
    expect(result.requiredFiles).toContain("See Through Scopes/fomod/ModuleConfig.xml");
  });

  it("still consults the native installer when no details are provided", async () => {
    // An undefined details object must not short-circuit interactive fomods.
    const result = await testSupported(xmlScriptFiles, undefined, false);

    expect(result.supported).toBe(true);
  });

  it("short-circuits to unsupported when details report no XmlScript config", async () => {
    const result = await testSupported(xmlScriptFiles, { hasXmlConfigXML: false }, false);

    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });

  it("does not report XmlScript support for an archive without a ModuleConfig.xml", async () => {
    const result = await testSupported(["data/a.esp", "readme.txt"], undefined, false);

    expect(result.supported).toBe(false);
  });

  it("supports any fomod via the Basic handler", async () => {
    const result = await testSupported(["data/a.esp"], undefined, true);

    expect(result.supported).toBe(true);
  });
});
