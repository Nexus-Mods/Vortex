import { afterEach, describe, expect, it, vi } from "vitest";

// Matches the Symbol.for key used by base.ts's tripwire.
const MARK = Symbol.for("vortex.errors.VortexError");

const clearMark = (): void => {
  delete (globalThis as Record<symbol, unknown>)[MARK];
};

// `vi.resetModules()` clears vitest's module registry, so a subsequent
// `import("./base")` re-executes the module's top-level code as a genuinely
// new instance, exactly like two independently-bundled copies of
// @vortex/shared would in a real process. `globalThis` itself is not reset,
// so the tripwire's global slot persists across these "reloads" the same way
// it would persist across two real bundles sharing one JS realm.
describe("VortexError module tripwire", () => {
  afterEach(() => {
    clearMark();
    vi.resetModules();
  });

  it("registers cleanly on first load in a realm", async () => {
    clearMark();
    vi.resetModules();

    await expect(import("./base")).resolves.toHaveProperty("VortexError");
  });

  it("throws if a second, distinct copy of the module loads in the same realm", async () => {
    clearMark();
    vi.resetModules();

    // First "copy": registers its VortexError class in the global slot.
    await import("./base");

    // Second, independently-evaluated copy in the same realm/globalThis,
    // the scenario the tripwire exists to catch.
    vi.resetModules();
    await expect(import("./base")).rejects.toThrow(/Duplicate @vortex\/shared error module/);
  });

  it("does not throw for the same cached module instance", async () => {
    clearMark();
    vi.resetModules();

    const first = await import("./base");
    // No resetModules in between: this is the normal case, the module
    // registry returns the cached instance without re-running top-level
    // code at all, so there is nothing to trip.
    const second = await import("./base");

    expect(second.VortexError).toBe(first.VortexError);
  });
});
