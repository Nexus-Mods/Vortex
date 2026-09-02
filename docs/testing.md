# Testing

How tests are organised and run, and the conventions for component and
extension tests.

## Running tests

`pnpm run test` from the repo root runs unit and integration tests across every
package. It **excludes the E2E suite** (`@vortex/e2e`), which needs a packaged
app and a real game install and runs separately.

Use `pnpm run test -- <path>` to run a single test file or directory.

The E2E harness sets two environment variables. `VORTEX_E2E=1` skips installing
the React and Redux DevTools chrome extensions (`installDevelExtensions` in
`src/main/src/devel.ts`), which otherwise slow the launch and add DevTools
targets the harness would have to ignore. `VORTEX_E2E_HEADLESS=1` makes the
`window:show` IPC handler in `src/main/src/ipcHandlers.ts` a no-op, so windows
stay hidden. Set them only through the harness; a normal dev run wants neither.

Tests are colocated with the code they cover, as `src/**/*.test.ts` (or
`*.test.tsx` for components). Component tests use `vitest` with
`@testing-library/react` v16.

## Finding elements in component tests

Pick the most specific selector that is unambiguous:

1. **A role**, where exactly one element in the query scope has it. This is the
   closest thing to how a user perceives the UI, so prefer it when it works.
2. **A `data-testid`**, when the element isn't addressable by role, or when
   several elements share the role. Add the attribute to the component:
   `Button`, `Input` and the other UI primitives spread unknown props onto the
   underlying element, and `IToolbarAction` takes a `testId`.

**Don't match on text in a component test.** There's no i18n instance in the
unit test setup, so `t` hands back the translation key it was given. A key can
be shared by several elements and tells you nothing about what the user sees, so
a test that matches on one is both ambiguous and misleading.

Text matching belongs in the E2E suite (`packages/e2e/`), which runs against the
real translations and so can assert on what a user actually reads.

Existing tests are mixed on this: you'll find `getByRole`, `getByTestId` and
`getByText` in roughly equal measure. The rule above is where we're heading, not
a description of every test in the tree.

## Extension tests

If an extension test imports `vortex-api`, add a local `vitest.config.ts` alias
to a `__mocks__/vortex-api.ts`, and mock only the exports the test uses.

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

## See also

- [frontend.md](frontend.md) - renderer conventions, including what to test
- `packages/e2e/` - the Playwright end-to-end suite
