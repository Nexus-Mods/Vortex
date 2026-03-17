import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "./logging";

/**
 * downloads and installs development extensions that help with redux / react development.
 * These are chrome extensions and thus appear in the development tools
 */
export async function installDevelExtensions(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  const {
    default: install,
    REACT_DEVELOPER_TOOLS,
    REDUX_DEVTOOLS,
  } = await import("electron-devtools-installer");

  const options = {
    loadExtensionOptions: { allowFileAccess: true },
  };

  try {
    // Cast needed: TS resolves `default` from dynamic CJS import as the module
    // namespace rather than the actual default export (the install function).
    // Alternatively we could just use double default import, but meh.
    type ExtensionRef = { id: string; electron: string };
    type InstallFn = (
      ref: ExtensionRef | string | Array<ExtensionRef | string>,
      options?:
        | {
            forceDownload?: boolean;
            loadExtensionOptions?: Record<string, unknown>;
          }
        | boolean,
    ) => Promise<string>;
    await (install as unknown as InstallFn)(REACT_DEVELOPER_TOOLS, options);
    await (install as unknown as InstallFn)(REDUX_DEVTOOLS, options);
  } catch (err) {
    log("error", "error installing dev tools", getErrorMessageOrDefault(err));
  }
}
