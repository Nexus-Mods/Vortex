// NOTE(erri120): yes, the library is called "jest-dom" but it works for vitest as well with this import:
// https://www.npmjs.com/package/@testing-library/jest-dom#with-vitest
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Many modules access window.api.log during import, so provide a default stub.
if (typeof window !== "undefined" && !(window as any).api) {
  (window as any).api = { log: vi.fn() };
}
