import { method as toBluebird } from "bluebird";
import { SupportsAppContainer } from "winapi-bindings";

import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IInstallationDetails } from "../mod_management/types/InstallFunc";
import type { ITestSupportedDetails } from "../mod_management/types/TestSupported";
import { install } from "./installer";
import { settingsReducer } from "./reducers/sandbox";
import { testSupported } from "./tester";
import Sandbox from "./views/Sandbox";

/**
 * Extension initialization
 */
const main = (context: IExtensionContext): boolean => {
  context.registerReducer(["settings", "mods"], settingsReducer);

  const osSupportsAppContainer = SupportsAppContainer?.() ?? false;
  context.registerSettings("Workarounds", Sandbox, () => ({
    osSupportsAppContainer,
  }));

  const installOutOfProcess = toBluebird(
    async (
      files: string[],
      destinationPath: string,
      gameId: string,
      _progressDelegate: unknown,
      choices?: unknown,
      unattended?: boolean,
      archivePath?: string,
      details?: IInstallationDetails,
    ) => {
      return await install(
        context.api,
        files,
        destinationPath,
        gameId,
        choices,
        unattended,
        archivePath,
        details,
      );
    },
  );

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 20,
    /*testSupported:*/ toBluebird(
      async (
        files: string[],
        gameId: string,
        _archivePath?: string,
        details?: ITestSupportedDetails,
      ) => {
        return await testSupported(context.api, files, gameId, details, "scripted");
      },
    ),
    /*install:*/ installOutOfProcess,
  );

  // Stand-in for the native installer's own basic handler, and registered at
  // its priority so that the installers between the two (dinput at 50,
  // script-extender at 50, ...) keep winning over a generic basic install.
  // Inert while the native addon loads - see the ipc tester.
  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 100,
    /*testSupported:*/ toBluebird(
      async (
        files: string[],
        gameId: string,
        _archivePath?: string,
        details?: ITestSupportedDetails,
      ) => {
        return await testSupported(context.api, files, gameId, details, "basic");
      },
    ),
    /*install:*/ installOutOfProcess,
  );

  return true;
};

export default main;
