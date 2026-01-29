import installExtension from "electron-devtools-installer";
import {
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from "electron-devtools-installer";

import { getErrorMessageOrDefault } from "../shared/errors";
import { log } from "./logging";

/**
 * downloads and installs development extensions that help with redux / react development.
 * These are chrome extensions and thus appear in the development tools
 */
export async function installDevelExtensions(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  const options = {
    loadExtensionOptions: { allowFileAccess: true },
  };

  try {
    await installExtension(REACT_DEVELOPER_TOOLS.id, options);
    await installExtension(REDUX_DEVTOOLS.id, options);
  } catch (err) {
    log("error", "error installing dev tools", getErrorMessageOrDefault(err));
  }
}
