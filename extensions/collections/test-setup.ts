import { vi } from "vitest";

// Many modules access window.api.log during import, so provide a default stub.
if (typeof window !== "undefined" && !(window as any).api) {
  (window as any).api = { log: vi.fn() };
}
