import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "./logging";

/**
 * downloads and installs development extensions that help with redux / react development.
 * These are chrome extensions and thus appear in the development tools
 */
export async function installDevelExtensions(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  const installer = (await import("electron-devtools-installer")).default;

  const options = {
    loadExtensionOptions: { allowFileAccess: true },
  };

  try {
    await installer.default(installer.REACT_DEVELOPER_TOOLS.id, options);
    await installer.default(installer.REDUX_DEVTOOLS.id, options);
  } catch (err) {
    log("error", "error installing dev tools", getErrorMessageOrDefault(err));
  }
}
