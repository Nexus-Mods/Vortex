# Vortex Renderer HMR — what shipped and how it works

*Tom / July 2026 — renderer hot module replacement is now on `master`. TL;DR: run `pnpm run dev`, edit a `.tsx`, see it update in the running app in ~1–2s with all state intact.*

## What you get

| You edit | What happens |
|---|---|
| A component (`.tsx`) | Hot-swapped in place via react-refresh — React/Redux state, inputs, scroll all survive. No reload. |
| A Tailwind class / CSS | `tailwind-v4.css` rebuilds and the stylesheet `<link>` is swapped in place. No reload. |
| A reducer, util, or extension `index.ts` | Can't be hot-applied — the window does an automatic clean reload. Intended behavior. |
| `src/main`, preload, `@vortex/shared` | Restart `pnpm run dev`. |
| Dynamic extensions (`extensions/`, `extensions/games/`) | Unchanged — app relaunch, as always. |

Watch the terminal for `[vortex-hmr] applied update ...` / `... reloading window`. Extra args pass through to Electron: `pnpm run dev --inspect=9229`.

## How it works (the unusual part)

**There is no dev server.** Vortex's renderer is not a normal web app: it loads from
`file://` via a literal Node `require("./renderer.js")`, runs with `nodeIntegration`, sits
behind a strict CSP, keeps ~200 packages (including native addons) *external* and resolves
them from disk at runtime, and relies on a real `__dirname` plus `Module._load`
monkey-patching. Serving it from `http://localhost` breaks every one of those anchors —
so we use webpack's *Node-style* HMR instead:

1. `pnpm run dev` (`scripts/dev.mjs`) does a cached Nx build, then starts
   `webpack --watch` with `VORTEX_HMR=1` and `tailwindcss --watch`, then launches
   Electron. The window loads **exactly what production loads** — same `index.html`,
   same CSP, same module resolution.
2. On save, webpack writes the delta to disk as `*.hot-update.js/json` files next to
   `renderer.js` (`chunkLoading: "require"` — the same machinery webpack uses for
   `target: "node"` HMR).
3. A ~90-line dev-only client compiled into the bundle
   (`src/renderer/tools/hmr-client.cjs`) polls `module.hot.check()` every 300ms and
   loads updates via Node `require()` from disk. Node module loading isn't subject to
   page CSP, so nothing about the security posture changes. The same client `fs.watch`es
   the CSS output for the stylesheet swap.
4. react-refresh (injected via a babel pass over ts-loader's output) re-registers the
   changed components and swaps them in place. Anything that isn't a pure component
   module bubbles to the entry and triggers the clean-reload fallback.

Touched files: `src/renderer/webpack.config.cjs` (all HMR config gated on `VORTEX_HMR=1`),
`src/renderer/tools/hmr-client.cjs`, `scripts/dev.mjs`, plus a small same-URL guard in
`MainWindow.ts`'s `will-navigate` handler so page-initiated reloads aren't hijacked into
the external browser (a latent bug anyway).

**Production is untouched.** Regular builds are byte-identical — the flag is only set by
`scripts/dev.mjs`, which deliberately runs webpack *outside* Nx so the HMR bundle never
enters the build cache. Hot-update files are deleted on dev start and exit; the only
persistent artifact is webpack's filesystem cache (~180 MB, self-pruning) which is what
makes incremental rebuilds ~1.3s.

## The alternative we considered (and why we didn't pick it)

The standard route is **webpack-dev-server**. The pure form — window loads
`http://localhost:PORT` — was ruled out quickly: it moves the app's origin, which breaks
the `require` bootstrap, `'self'` CSP semantics, external module resolution, `__dirname`,
and localStorage keying, and it makes dev behave differently from prod in ways that rest
on undocumented Electron internals.

The serious contender was a **hybrid**: keep the page on `file://`, keep `renderer.js`
written to disk (`devMiddleware.writeToDisk`), and use the dev server only as the
hot-update *transport* — updates pushed over a websocket, chunks fetched over http. Pros:
stock tooling (webpack-dev-server + its client), instant push instead of 300ms polling,
and the standard error overlay. Cons: a second `index.dev.html` with a relaxed dev CSP
(`connect-src ws://localhost`), a dev/prod branch in `MainWindow.ts` including
server-readiness polling, CORS quirks for `hot-update.json` fetches from a `file://`
origin, and an open port — several spike-flagged unknowns versus zero for the disk-based
route.

Both were designed in full; disk-based won because every one of its failure modes is
dev-only and self-healing ("update didn't apply → window reloads"), it required no
changes to CSP, HTML, or window loading, and the entire bespoke surface is one ~90-line
client. The hybrid remains the documented fallback if we ever want push-based updates or
the overlay.

## Linux dev-machine gotchas (put these in your root `.env`, it's gitignored)

- `ELECTRON_DISABLE_SANDBOX=1` — newer Ubuntu restricts unprivileged user namespaces, so
  unpacked Electron's SUID sandbox helper aborts at launch without this.
- `DOTNET_ROLL_FORWARD=Major` — the `dotnetprobe` helper targets net9.0; distros that
  only package .NET 10 need this so the probe can run (it accepts any runtime ≥ 9).

## Known limits / possible follow-ups

- Main-process/preload watch + auto-restart of Electron (extend `scripts/dev.mjs`).
- `@vortex/shared` in the HMR graph (it has a `"development"` export condition ready).
- No error overlay — compile errors show in the terminal, runtime errors in DevTools.
- Belt-and-braces: exclude `*.hot-update.*` from packaging in case a hard-killed dev
  session leaves stale files behind (they're inert, just dead weight).
