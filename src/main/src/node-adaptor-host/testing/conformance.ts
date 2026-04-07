import { describe, expect, it, beforeAll, afterAll } from "vitest";

import type { IMessageHandler } from "@vortex/adaptor-api/interfaces";
import { adaptorName, semver, uri } from "@vortex/adaptor-api/branded";

import { createTestHarness, type ITestHarness } from "./harness.js";

export function runConformanceTests(
  bundlePath: string,
  services?: Record<string, IMessageHandler>,
  bootstrapPath?: string,
): void {
  describe("adaptor conformance", () => {
    let harness: ITestHarness;

    beforeAll(async () => {
      harness = await createTestHarness(bundlePath, services, bootstrapPath);
    });

    it("loads in a Worker and returns a valid manifest", () => {
      const m = harness.manifest;

      expect(() => uri(m.id)).not.toThrow();
      expect(() => adaptorName(m.name)).not.toThrow();
      expect(() => semver(m.version)).not.toThrow();
      for (const u of m.provides) {
        expect(() => uri(u)).not.toThrow();
      }
      for (const u of m.requires) {
        expect(() => uri(u)).not.toThrow();
      }
    });

    it("declares at least one provided URI", () => {
      expect(harness.registeredHandlers().length).toBeGreaterThan(0);
    });

    afterAll(async () => {
      await harness?.shutdown();
    });
  });
}
