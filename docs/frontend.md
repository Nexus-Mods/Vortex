# Frontend (renderer)

Conventions for the React/TypeScript renderer (`src/renderer`). Match the
surrounding code first; this captures the defaults for when there's no local
precedent.

## Stack

- **React 18.3.1 on the legacy `ReactDOM.render` root** (React 17-compatible
  behavior) - function components and hooks only. Do NOT use `createRoot`,
  concurrent features, or `StrictMode` yet; the createRoot flip is a separate,
  later release. Class components, legacy context and `findDOMNode` remain
  functional but deprecated. Don't introduce new usages.
- **TypeScript** (type-checked ESLint). `import type { ... }` for types
  (`consistent-type-imports` is an error).
- **Tailwind v4** for styling, **react-redux** for state, **react-i18next** for
  copy, Electron renderer process.

## The public extension API

If you change exported types in `types/api.ts` (for example
`IMainPageOptions`), run `pnpm run api` and commit the regenerated
`etc/vortex.api.md`. Add a one-line TSDoc `/** ... */` so the entry isn't
`(undocumented)` in the report.

This is the one renderer-specific step that isn't covered by the standard
build/test/format loop.

## Files and structure

- Shared UI: `src/renderer/src/ui/components/<snake_case>/<PascalCase>.tsx`.
- Feature UI: `src/renderer/src/extensions/<ext>/...` (`components/`, `views/`,
  `hooks/`, `utils/`, `selectors.ts`).
- Colocate `<Name>.test.tsx` and, for shared components, `<Name>.demo.tsx`.
- One component per file, named exports for components. Helpers and selectors
  move to `utils/`/`hooks/` rather than staying inline in a view, once reused.

## Types

- Define a type or interface in the file that consumes it. Only lift it to a
  shared module (`types.ts`, a `utils/`/`hooks/` file) once more than one file
  needs it. Don't create a shared type file pre-emptively.
- Name interfaces with an `I` prefix (`IMainPage`, `IHealthCheckEntry`,
  `ITabButtonProps`). Union and alias types stay plain PascalCase (`Severity`,
  `FileRequirementCategory`). Keep new names consistent with their neighbours.

## Components and props

- Function components with a typed props interface.
- Prop order is auto-enforced (`perfectionist/sort-jsx-props`): shorthand first,
  then alphabetical, callbacks (`on*`) last. Don't hand-order; run
  `pnpm run format`.
- Prefer composition and small leaf components over large ones.
- Self-closing tags for empty elements (lint-enforced).
- **Omit props equal to their default.** Don't pass a prop whose value is
  already the component's default (`Button`/`Typography` `appearance="strong"`,
  `Typography` `brand="neutral"`, `Pictogram` `size="md"`). Redundant
  assignments pin call sites to today's default and block a future sweeping
  change from applying consistently. Set a prop only when it differs.

## Imports

- `oxfmt` owns import grouping and ordering (external, then `@/` alias, then
  relative, alphabetical within each group). Don't fight it; run
  `pnpm run format`.
- Unused vars and args are errors unless prefixed `_`.
- **React imports:** if a file already has `import * as React from "react"`,
  keep using `React.*` references - don't mix styles within a file. In files
  without it, import what you need by name
  (`import { useCallback, type ReactNode } from "react"`) and never add a new
  `import * as React` or `import type * as React` line.

## Styling

- Utility classes via `className`. Build conditional or among-many class strings
  with `joinClasses([...classes], { "class": condition })` - it's lint-aware, so
  Tailwind classes inside it get ordered and validated too.
- Class order is auto-enforced (`better-tailwindcss`); let `--fix` or
  `pnpm run format` sort it.
- Use design tokens, not raw colors: `bg-surface-*`, `text-neutral-*`,
  `bg-danger-strong`, `bg-warning-moderate`, `bg-info-moderate`, and so on.
- Shared components also expose semantic `nxm-`-prefixed classes
  (`nxm-tab-button`). Keep that pattern for reusable primitives.

## State (Redux)

- `useSelector` with a **stable selector reference**: a module-level function,
  not an inline closure that returns a fresh value on each call.
- Subscribe to the **narrowest slice** you need. Health-check-style features
  dispatch frequently, and a broad subscription re-renders on unrelated writes.
- **Never return a freshly-created object, array or React element from a
  selector.** Referential inequality forces a re-render on every dispatch.
  Return primitives or stable refs and map to objects or nodes in the component.
- Push a hot subscription down into a small leaf component so only it
  re-renders. See `HealthCheckMenuBadge` and `LastUpdated`.

## i18n

Localize with `useTranslation(["ns", "common"])`. For namespaces and key format,
see [I18N_MIGRATION_GUIDE.md](I18N_MIGRATION_GUIDE.md).

**Never derive identity, logic, state, keys or comparisons from a translated
string.** It changes per language and silently breaks. Use a stable id or enum
for identity and translate only for display.

This is exactly how the tab selection bug happened: identity was a slug of the
label, so selecting a tab stopped working as soon as the label was translated.

## Icons

- MDI paths from `@mdi/js`, mapped in `views/components/iconMap.ts` via
  `getIconPath(name)`. Pages can pass an `mdi` path directly.
- Custom SVGs must use the 24x24 viewBox the `Icon` component renders. To port a
  Material Symbols icon (`0 -960 960 960`): scale by 0.025 and offset absolute Y
  by +960. Keep it a single filled path with `fill="currentColor"`.

## Pages and extensions

- Register with `context.registerMainPage(icon, title, Component, options)`.
- `newLayout: true` opts into the redesigned chrome, where the page renders its
  own `<Page>`, `<PageHeader>` and `<PageScroll>`. For converting an existing
  page, see [design-system/page-migration.md](design-system/page-migration.md).
- Optional menu extras are self-contained components (such as `menuBadge`) that
  subscribe to their own state.

## Accessibility

Use correct roles and attributes (`role="tab"`/`tabpanel`, `aria-controls`,
`aria-selected`) and support keyboard navigation for custom interactive UI.

## Testing

`vitest` with `@testing-library/react` v16, colocated as `<Name>.test.tsx`. For
how to select elements and the extension-test mocking pattern, see
[testing.md](testing.md).

## Comments

Prefer self-documenting names over comments. Comment the non-obvious **why** (a
subscription tradeoff, a workaround), not the **what**. Remove narration.
