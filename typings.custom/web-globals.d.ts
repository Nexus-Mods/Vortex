// Cross-platform host globals for packages that compile against a minimal
// `lib` (i.e. `["ESNext"]`) with no `node` types or `dom` lib — currently
// `@vortex/shared`, which runs in BOTH the Electron main (Node) and renderer
// (browser) processes and must not assume either environment's extras
// (`process`/`Buffer` or `document`/`window`).
//
// `URL` exists in both runtimes (Node and Chromium), so declaring it here lets
// such a package use it without pulling in a whole environment lib. Packages
// that already get `URL` from `dom`/`node` (e.g. the renderer, which uses the
// `dom` lib) must NOT include this file — it would redeclare the global.
// Include it explicitly only from a lib-minimal package's tsconfig.

/**
 * WHATWG `URL`. Only construction and `toString()` are used today; the other
 * members are declared so `URL` stays structurally distinct from any other
 * `{ toString(): string }` type (e.g. `number`), which matters for the
 * `T[K] extends URL` check in the `Wirify` mapped type (see shared `types/ipc.ts`).
 */
declare class URL {
  constructor(url: string | URL, base?: string | URL);
  readonly href: string;
  readonly origin: string;
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
}

interface URLSearchParams {
  get(name: string): string | null;
}
