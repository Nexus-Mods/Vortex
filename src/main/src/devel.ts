import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "./logging";

/**
 * downloads and installs development extensions that help with redux / react development.
 * These are chrome extensions and thus appear in the development tools
 */
export async function installDevelExtensions(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.VORTEX_E2E === "1") return;

  const { installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } =
    await import("electron-extension-installer");

  try {
    await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
      loadExtensionOptions: { allowFileAccess: true },
    });
  } catch (err) {
    log("error", "error installing dev tools", getErrorMessageOrDefault(err));
  }
}
