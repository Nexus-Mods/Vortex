/**
 * Stand-in for react-i18next in renderer component tests. There's no i18n instance in
 * the test setup, so `t` hands back the key it was given — which is what the tests then
 * query the rendered output by.
 *
 * A vi.mock factory runs before the test file's own imports are initialized, so it can't
 * close over one. Load this module inside the factory instead:
 *
 *   vi.mock("react-i18next", () => vi.importActual("@/test-utils/i18nMock"));
 *
 * importActual rather than a bare `import()`: this package is commonjs, and tsc treats an
 * `import()` expression as ESM, where node16 resolution demands a file extension the
 * bundler then can't resolve. importActual takes a plain string, so neither complains.
 *
 * Test-only: nothing in the production tree imports this module.
 */

export const useTranslation = () => ({ t: (key: string) => key });

/** For the class components still wrapped in the HOC rather than using the hook. */
export const withTranslation = () => (component: unknown) => component;

export const translate = () => (component: unknown) => component;
