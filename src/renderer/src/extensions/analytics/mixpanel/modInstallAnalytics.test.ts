/**
 * Unit tests for classifyInstallKind: how a mod install is labelled for the mods_installation_*
 * install_kind, given the mod being replaced (captured before removal) and the incoming file id.
 */
import { describe, expect, it } from "vitest";

import { makeMod } from "../../../test-utils/builders";
import { classifyInstallKind } from "./modInstallAnalytics";

describe("classifyInstallKind", () => {
  it("is fresh when there is no prior version", () => {
    expect(classifyInstallKind(undefined, 200)).toBe("fresh");
  });

  it("is reinstall when the same file id goes over itself", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 200 } }), 200)).toBe("reinstall");
  });

  it("is version_update for a different file id", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 150 } }), 200)).toBe(
      "version_update",
    );
  });

  it("is variant when the name conflict was resolved as a coexisting variant", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 200 } }), 200, "variant")).toBe(
      "variant",
    );
  });

  it("is profile_replace when the name conflict was resolved as a replace", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 150 } }), 200, "replace")).toBe(
      "profile_replace",
    );
  });
});
