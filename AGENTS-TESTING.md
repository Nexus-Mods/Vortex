# Testing Guide

Use `pnpm run test -- <path>` to run a specific test file or directory.

Tests are colocated as `src/**/*.test.ts`.

## Finding elements in component tests

Target a `data-testid` (or a role, where one element unambiguously has it). Add the attribute to the component; `Button`, `Input` and the other UI primitives spread unknown props onto the underlying element, and `IToolbarAction` takes a `testId`.

Don't look elements up by their text. There's no i18n instance in the test setup, so `t` hands back the translation key it was given — a key can be shared by several elements and tells you nothing about what the user sees, so a test that matches on one is both ambiguous and misleading. Text matching belongs in the E2E suite, which runs against the real translations.

## Extension tests

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
