import { watch } from "node:fs";
import * as path from "node:path";

// Dev-only: dev.mjs prepends this to the renderer entry. It is never part of a
// production bundle.
//
// dev.mjs touches RELOAD_MARKER after every successful rebuild of the
// renderer, so the window reloads once per build and never while the bundle
// is half written. The current page survives the reload: the main process
// hands the session state back to the new renderer.
//
// Stylesheets rebuilt by tailwind:watch are swapped in place without a reload.

const RELOAD_MARKER = "renderer.reload";
const LOG_PREFIX = "[vortex-dev]";

if (process.env.NODE_ENV === "development") {
  try {
    let pending: ReturnType<typeof setTimeout> | undefined;
    watch(__dirname, (_, file) => {
      if (file !== RELOAD_MARKER) return;
      // fs.watch reports one write as several events; reload once
      clearTimeout(pending);
      pending = setTimeout(() => {
        console.log(`${LOG_PREFIX} renderer rebuilt, reloading window`);
        window.location.reload();
      }, 50);
    });
  } catch (err) {
    console.warn(`${LOG_PREFIX} rebuild watch unavailable`, err);
  }

  const cssDir = path.join(__dirname, "assets", "css");

  try {
    watch(cssDir, (_, file) => {
      if (file == null || !file.endsWith(".css")) return;

      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const href = (link.getAttribute("href") ?? "").split("?")[0];
        if (href.endsWith(`/${file}`) || href === `assets/css/${file}`) {
          link.setAttribute("href", `${href}?v=${Date.now()}`);
          console.log(`${LOG_PREFIX} swapped stylesheet ${file}`);
        }
      }
    });
  } catch (err) {
    console.warn(`${LOG_PREFIX} css watch unavailable`, err);
  }

  console.log(`${LOG_PREFIX} ready`);
}
