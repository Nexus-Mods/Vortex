import { log } from "../logging";
import { registerDeprecatedApi } from "./deprecatedApiUsage";
import { isUrlTarget } from "./is_url_target/isUrlTarget";

// Only backs util.opn in the extension API. Vortex's own code calls window.api.shell
// directly, and lint blocks new imports of this file.

/**
 * Opens a URL in the default browser, or a file or folder in its default application.
 *
 * @deprecated Call `window.api.shell.openUrl` for a URL or `window.api.shell.openFile` for
 * a path. The removal release will be announced in the vortex-api CHANGELOG at least two
 * releases ahead.
 */
function open(target: string, _wait?: boolean): Promise<void> {
  if (!target) {
    log("warn", "No target provided to open function");
    return Promise.resolve();
  }

  if (isUrlTarget(target)) {
    window.api.shell.openUrl(target);
  } else {
    window.api.shell.openFile(target);
  }

  return Promise.resolve();
}

registerDeprecatedApi<typeof open>("util.opn", {
  makeForCaller: (report) => (target, wait) => {
    report("util.opn", "window.api.shell.openUrl or window.api.shell.openFile");
    return open(target, wait);
  },
});

/** @deprecated */
export default open;
