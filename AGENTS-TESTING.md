# Testing Guide

Use `pnpm run test -- <path>` to run a specific test file or directory.

Tests are colocated as `src/**/*.test.ts`.

If an extension test imports `vortex-api`, add a local `vitest.config.ts` alias to `__mocks__/vortex-api.ts`, and mock only the exports the test uses.

```ts
// vitest.config.ts
import * as path from "node:path";

resolve: {
  alias: {
    "vortex-api": path.resolve(import.meta.dirname, "__mocks__/vortex-api.ts"),
  },
}

// __mocks__/vortex-api.ts
import { vi } from "vitest";

export const fs = {};
export const util = {};
export const log = vi.fn();
```
