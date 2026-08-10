import { watch } from "node:fs";
import * as path from "node:path";

// https://github.com/webpack/webpack/blob/main/lib/hmr/HotModuleReplacement.runtime.js
type ModuleId = string | number;

type WebpackHMR = {
  status(): "idle" | "check" | "prepare" | "ready" | "dispose" | "apply" | "abort" | "fail";
  check(applyOnUpdate?: boolean): Promise<ModuleId[] | null>;
};

if (process.env.NODE_ENV === "development" && "hot" in module && typeof module.hot === "object") {
  const hot = module.hot as unknown as WebpackHMR;

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

  const reload = (why: string) => {
    console.log(`[vortex-hmr] ${why}, reloading window`);
    window.location.reload();
  };

  const check = () => {
    if (hot.status() !== "idle") return;

    hot
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
        const status = hot.status();
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

  const cssDir = path.join(__dirname, "assets", "css");

  try {
    watch(cssDir, (_, file) => {
      if (file == null || !file.endsWith(".css")) return;

      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const href = (link.getAttribute("href") ?? "").split("?")[0];
        if (href.endsWith(`/${file}`) || href === `assets/css/${file}`) {
          link.setAttribute("href", `${href}?v=${Date.now()}`);
          console.log(`[vortex-hmr] swapped stylesheet ${file}`);
        }
      }
    });
  } catch (err) {
    console.warn("[vortex-hmr] css watch unavailable", err);
  }

  console.log("[vortex-hmr] ready");
}
