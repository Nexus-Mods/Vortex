/* Dev-only HMR client, prepended to the renderer entry by webpack.config.cjs
 * when VORTEX_HMR=1 (started via `pnpm dev`, see scripts/dev.mjs).
 *
 * The renderer bundle is a real CommonJS module require()'d from disk, so hot
 * updates are plain files in the build directory loaded through node's
 * require() — no dev server, no websocket, no CSP involvement. This client
 * polls for updates the same way webpack/hot/poll does, but falls back to a
 * page reload when an update can't be hot-applied (reducers, utils,
 * extension init code), which matches webpack-dev-server semantics.
 *
 * Only console.log/warn in here: an error-level console message before the
 * window is shown arms a 15s "failed to start" watchdog in MainWindow.ts.
 */

if (module.hot) {
    // react-refresh must patch the devtools hook before react-dom is first
    // required. The refresh plugin prepends its own entry that does this;
    // doing it again here is idempotent and guards against plugin changes.
    try {
        require("react-refresh/runtime").injectIntoGlobalHook(window);
    } catch (err) {
        console.warn("[vortex-hmr] react-refresh hook injection failed", err);
    }

    const POLL_MS = 300;
    let failedOnce = false;

    const reload = (why) => {
        console.log(`[vortex-hmr] ${why}, reloading window`);
        window.location.reload();
    };

    const check = () => {
        if (module.hot.status() !== "idle") {
            return;
        }
        module.hot
            .check(true)
            .then((updated) => {
                failedOnce = false;
                if (updated == null) {
                    return; // no update pending
                }
                console.log(
                    "[vortex-hmr] applied update",
                    updated.map((id) => String(id)),
                );
                check(); // drain queued updates from rapid consecutive edits
            })
            .catch((err) => {
                const status = module.hot.status();
                if (status === "abort" || status === "fail") {
                    // update reached modules nobody accepts (or apply failed);
                    // a reload gives a fresh require of the full new bundle
                    reload("update could not be hot-applied");
                } else if (!failedOnce) {
                    // likely caught a hot-update file mid-write; retry once
                    failedOnce = true;
                } else {
                    console.warn("[vortex-hmr] update check failed twice", err);
                    reload("update check failed");
                }
            });
    };

    setInterval(check, POLL_MS);

    // Tailwind CSS live-swap: scripts/dev.mjs rebuilds build/assets/css/*.css
    // on change; bump the matching <link> href to apply it without a reload.
    const fs = require("fs");
    const path = require("path");
    // real value, not a webpack shim (node.__dirname is disabled): the
    // directory of renderer.js on disk, i.e. src/main/build
    const cssDir = path.join(__dirname, "assets", "css");
    const pending = new Map();
    try {
        fs.watch(cssDir, (_event, file) => {
            if (file == null || !file.endsWith(".css")) {
                return;
            }
            clearTimeout(pending.get(file));
            pending.set(
                file,
                setTimeout(() => {
                    pending.delete(file);
                    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
                        const href = (link.getAttribute("href") ?? "").split("?")[0];
                        if (href.endsWith(`/${file}`) || href === `assets/css/${file}`) {
                            link.setAttribute("href", `${href}?v=${Date.now()}`);
                            console.log(`[vortex-hmr] swapped stylesheet ${file}`);
                        }
                    }
                }, 100),
            );
        });
    } catch (err) {
        console.warn("[vortex-hmr] css watch unavailable", err);
    }

    console.log("[vortex-hmr] ready");
}
